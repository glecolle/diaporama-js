class Diaporama {

    /** Add or remove this amount of seconds when using arrow keys */
    static speedIncrement = 10;

    /** Remove images after this delay, must be equal or greater than .frame animation delay */
    static removeDelay = 40 * 1000 - 200;

    /** Randomize or not */
    static randomize = true;
    static tiltDegrees = 7;
    static rotationCenterPercent = 50;

    /** Size, ratio compared to viewport height */
    static smallerSize = 0.55;
    static smallSize = 0.75;
    static normalSize = 0.85;
    static bigSize = 1.1;
    static biggerSize = 1.25;

    /** Array of sequences to play, a sequence contains images and defines a structure for timing calculation */
    static sequences = [];

    /** The time in seconds from epoch when the diaporama started */
    static startTime;

    /** Delay for interval, needs to be big enough for image loading but the smaller the more reactive when moving fast forward */
    static delay = 0.5;

    /** Display progress information */
    static info = false;

    /** Enable looping for continuous play*/
    static loop = false;

    /** Init diaporama with given images and music
     * When music is provided, duration and delay are automatically calculated to match music duration (until another music is set or gets null)
     * Delay is the time
     *  @param data [
     *      {defaultDelay:<s>, defaultDuration:<s>, defaultPosition:"<see img position>"}, randomSeed:<int>},
     *      {music:<path>, begin:<s>, end:<s>},
     *      {img:<path>, delay:<s>, duration:<s>, text:<some_text>, params: "space searated values for vertical: top/middle/bottom and horizontal: left/center/right, default is middle center [smaller small big bigger]"},
     *      {music:null}
     *  ]
     */
    constructor(data) {
        Diaporama.sequences = [];
        this.paused = false;

        // une fois déposée, imprimer l'image sur le fond ? cela permettrait d'optimiser les perfs en n'ayant qu'une image à la fois (nécessite d'imprimer l'image et le texte sur le canvas du fond avec la même position) -> très complexe à mettre en oeuvre
        // reste à corriger le problème de flash lors de la suppression des photos tester avec du display none
        // faire un mode un fichier qui combine scripts, données et css dans un unique fichier

        data.forEach(d => this.addItem(d));
        Log.info("sequences", Diaporama.sequences);
        let nextStart = 0;
        Diaporama.sequences.forEach(function (s) {
            let next = s.compute(nextStart);
            nextStart = next;
        });
        this.finish = nextStart;
        Log.info("diaporama finishes at", this.finish);
        this.start();

        document.getElementById("body").addEventListener("keydown", this.keyEvent.bind(this));
    }

    static setInfo(v) {
        Diaporama.info = v;
    }

    static setLoop(v) {
        Diaporama.loop = v;
    }

    keyEvent(event) {
        Log.info("event", event.key);
        if (event.key === " ") {
            this.paused = !this.paused;
            if (this.paused) {
                document.getElementById("message").innerText = "Pause";
            } else {
                document.getElementById("message").innerText = "";
            }
        } else if (event.key == "ArrowRight") {
            Diaporama.startTime -= Diaporama.speedIncrement;
            this.clear();
        } else if (event.key == "ArrowLeft") {
            Diaporama.startTime += Diaporama.speedIncrement;
            this.clear();
        }
    }

    /** Add audio tags for preload (can only be played after an interaction from the user, like a click) */
    static prepareAudio(data) {
        let i = 0;
        data.forEach(d => {
            if (typeof d.music != "undefined") {
                let soundTrackID = "soundtrack-"+i;
                d.soundTrackID = soundTrackID;
                let path = window.location.href.replace("diaporama.html", d.music);
                document.getElementById("body").insertAdjacentHTML("afterend", `<audio id="${soundTrackID}" src="${path}"  preload="auto"></audio>`);
                i++;
            }
        });
    }

    /** Add an item, can be either an image or a sequence */
    addItem(i) {
        Log.info("add item", i);

        // object type
        if (typeof i.music != "undefined" || typeof i.end != "undefined") {
            //get music duration
            //compute previous images duration
            let newSequence = new Sequence(i.music, i.begin, i.end, i.soundTrackID)
            Diaporama.sequences.push(newSequence);
        }

        let currentSequence = this.getLastSequence(i);

        //options
        if (typeof i.defaultDelay != "undefined") {
            currentSequence.defaultDelay = i.defaultDelay;
        }
        if (typeof i.defaultDuration != "undefined") {
            currentSequence.defaultDuration = i.defaultDuration;
        }
        if (typeof i.defaultPosition != "undefined") {
            currentSequence.defaultDuration = i.defaultPosition;
        }

        // image
        if (typeof i.img != "undefined") {
            // add image, if duration/delay are set, add those values to current sequence
            currentSequence.add(new Image(currentSequence, i.img, i.delay, i.duration, i.params, i.text));
        }
    }

    /** Get last sequence or create a new one is missing */
    getLastSequence(i) {
        if (Diaporama.sequences.length == 0) {
            // create a default sequence if none has been set
            let s = new Sequence(i.music, i.begin, i.end);
            Diaporama.sequences.push(s);
        }
        return Diaporama.sequences[Diaporama.sequences.length-1];
    }

    /** @return the time in seconds elapsed since the beginning of the diaporama */
    static getCursor() {
        return new Date().getTime()/1000 - Diaporama.startTime;
    }

    start() {
        Diaporama.startTime = new Date().getTime()/1000 + 2 * Diaporama.delay; // start within two intervals in the future to prepare loading
        Log.info("play start=", Diaporama.startTime);
        let from = 0;
        let timer;
        let currentProgress = document.getElementById("currentProgress");
        timer = setInterval(() => {
            let cursor = Diaporama.getCursor();

            if (this.paused) {
                Diaporama.startTime = Diaporama.startTime + cursor - from;
                Diaporama.sequences.forEach(s => { s.pause(); });
                Log.info("paused, new cursor", Diaporama.getCursor());
                return;
            }

            if (cursor > this.finish ) {
                if (Diaporama.loop) {
                    //restart from now
                    Diaporama.startTime = new Date().getTime()/1000 + 2 * Diaporama.delay;
                } else {
                    clearInterval(timer);
                    return;
                }
            }
            let to = cursor + Diaporama.delay; //always look ahead from current cursor, as it's not guaranted that interval wakes up at the exact timing
            Diaporama.sequences.forEach(s => {
                s.play(cursor, from, to);
            });
            from = to;

            currentProgress.style.setProperty("width", parseInt(cursor/this.finish*100)+"%");
        }, Diaporama.delay*1000);
    }

    clear() {
        Diaporama.sequences.forEach(s => {
            s.pause();
            document.getElementById("images").innerHTML = "";
            setTimeout(() => { document.getElementById("images").innerHTML = ""; }, Diaporama.delay);
        });
    }
}

/** A sequence is a serie of pictures with an optional music */
class Sequence {
    defaultDelay = 0;
    defaultDuration = 0;
    defaultPosition = "center";

    constructor(musicFile, begin, end, soundTrackID) {
        this.items = [];
        this.begin = typeof begin != "undefined" ? begin : 0;
        this.end = typeof end != "undefined" ? end : undefined;
        this.forcedDuration = 0;
        this.forcedDurationCount = 0;
        this.forcedDelay = 0;
        this.forcedDelayCount = 0;
        this.musicFile = musicFile;

        this.sequenceID = "sequence"+Diaporama.sequences.length;
        this.audioElement =  document.getElementById(soundTrackID);
        if (this.audioElement) {
            this.duration = this.audioElement.duration;
        } else {
            if (!end) {
                throw new Error("without music, a sequence must have end attribute");
            }
            this.duration = end;
        }

        if (end) {
            if (this.duration < end) {
                Log.error("attribute end="+end+" is after the end of the audio track: " +musicFile)
            } else {
                this.duration = end;
            }
        } else {
            this.end = this.duration;
        }
        if (begin) {
            this.duration -= begin;
        }

        Log.info(this.sequenceID, "will last", this.duration, "seconds");
    }

    /** Add an image to the sequence */
    add(image) {
        this.items.push(image);

        if (typeof image.delay != "undefined") {
            this.forcedDelay += image.delay;
            this.forcedDelayCount++;
        }
        if (typeof image.duration != "undefined") {
            this.forcedDuration += image.duration;
            this.forcedDurationCount++;
        }
    }

    /** Evaluate durations for all images
     * @return the start time for next item
     */
    compute(nextStart) {
        let totalTimeLeft = this.end - this.begin - this.forcedDuration - this.forcedDelay;
        if (totalTimeLeft < 0) {
            Log.error("not enough time left to compute sequence", this.sequenceID);
            throw new Error("NO_TIME_LEFT");
        }

        let meanDuration = totalTimeLeft * 0.75 / (this.items.length - this.forcedDurationCount);
        let meanDelay = totalTimeLeft * 0.25 / (this.items.length - this.forcedDelayCount);
        Log.info(this.sequenceID, "has a total time left of ", totalTimeLeft, " a mean delay of", meanDelay, "and mean duration of", meanDuration, "(forcedDelay:", this.forcedDuration, ", forcedDuration:", this.forcedDelay,")");

        this.start = nextStart;

        let s = nextStart;
        this.items.forEach(i => {
            let f = i.compute(s, meanDelay, meanDuration);
            s = f;
        });

        this.finish = s;

        Log.info(this.sequenceID, "starts at", this.start, "and finishes at", this.finish);

        return this.finish;
    }

    /** Play any item according to current position and delay */
    play(cursor, from, to) {
        if (this.start <= to && this.finish > from) {
            Log.debug("play", this.sequenceID, ...arguments, this.start, this.finish);
            if (Diaporama.info) {
                document.getElementById("sequence").innerText = this.sequenceID;
                document.getElementById("music").innerText = this.musicFile ? this.musicFile : "no music";
                document.getElementById("elapsedInSequence").innerText = Math.round(cursor - this.start)+"s";
                document.getElementById("elapsedTotal").innerText = Math.round(cursor)+"s";
            }

            if (this.audioElement) {
                if (this.audioElement.paused || this.audioElement.currentTime == 0) {
                    this.audioElement.currentTime = cursor - this.start + this.begin;
                    this.audioElement.play();
                }

                if (from <= this.finish && this.finish < to) {
                    setTimeout(() => {
                        this.audioElement.pause();
                    }, (this.finish - cursor) * 1000);
                }
            }

            this.items.forEach(i => {
                i.play(cursor, from, to);
            });
        }
    }

    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
        }
    }
}

/** An image describes how an image must be displayed (image, delay, duration, position, text) */
class Image {

    constructor(parentSequence, path, delay, duration, params, text) {
        Log.info("new image", ...arguments);
        this.parentSequence = parentSequence;
        this.file=path;
        if (typeof delay != "undefined") {
            this.delay = delay;
        } else if (parentSequence.defaultDelay) {
            this.delay = parentSequence.defaultDelay;
        }
        if (typeof duration != "undefined") {
            this.duration = duration;
        } else if (parentSequence.defaultDuration) {
            this.duration = parentSequence.defaultDuration;
        }
        if (typeof params != "undefined") {
            this.position = params;
        } else {
            this.position = parentSequence.defaultPosition;
        }
        this.text = text ? text : "";

        let computedPosition = [];
        if (this.position.indexOf("top") !== -1) {
            computedPosition.push("top");
        } else if (this.position.indexOf("bottom") !== -1) {
            computedPosition.push("bottom");
        } else {
            computedPosition.push("middle");
        }

        if (this.position.indexOf("left") !== -1) {
            computedPosition.push("left");
        } else if (this.position.indexOf("right") !== -1) {
            computedPosition.push("right");
        } else {
            computedPosition.push("center");
        }

        let computedSize = [];
        if (this.position.indexOf("smaller") !== -1) {
            computedSize.push("smaller");
        } else if (this.position.indexOf("small") !== -1) {
            computedSize.push("small");
        } else if (this.position.indexOf("bigger") !== -1) {
            computedSize.push("bigger");
        } else if (this.position.indexOf("big") !== -1) {
            computedSize.push("big");
        }

        this.position = computedPosition.join(" ");
        this.size = computedSize.join("");
    }

    /** Set duration and delay if not already set */
    compute(nextStart, delay, duration) {
        if (typeof this.delay == "undefined") {
            this.delay = delay;
        }
        if (typeof this.duration == "undefined") {
            this.duration = duration;
        }

        this.start = nextStart;
        this.finish = this.start + this.delay + this.duration;

        Log.info("image", this.file, "has a delay of", this.delay, "and a duration of", this.duration, ", starts at", this.start, "lasts", this.finish - this.start,  "and finishes at", this.finish);
        return this.finish;
    }

    /** Play an when it belongs to [from ; to[ interval, set delay according to current cursor */
    play(cursor, from, to) {
        this.imageID = "image"+parseInt(this.start *1000)+"-"+parseInt(Diaporama.startTime*1000); //new image ID when seeking new time

        if (from <= this.finish && this.start < to && !document.getElementById(this.imageID)) {
            if (Diaporama.info) {
                document.getElementById("currentImage").innerText = this.file;
                document.getElementById("currentImageDelay").innerText = (parseInt(this.delay*10)/10)+"s";
                document.getElementById("currentImageDuration").innerText = (parseInt(this.duration*10)/10)+"s";
            }
            Log.debug("play image", this.imageID);

            // randomize position and rotation
            let tilt = Diaporama.randomize ? (Math.random() - 0.5) * 2 * Diaporama.tiltDegrees : 0;
            let centerX = Diaporama.randomize ? (Math.random() - 0.5) * Diaporama.rotationCenterPercent + 50 : 0;
            let centerY = Diaporama.randomize ? (Math.random() - 0.5) * Diaporama.rotationCenterPercent + 50 : 0;

            document.getElementById("images").insertAdjacentHTML("beforeend",
                `<div id="${this.imageID}" class="frame hidden ${this.position}">
                    <div class="animation-frame" style="animation-duration: ${this.delay}s">
                        <div class="inner-frame" style="transform: rotate( ${tilt}deg ); transform-origin: ${centerX}% ${centerY}%">
                            <!-- canvas will be added here -->
                            <div class="subtitle">${this.text}</div>
                        </div>
                    </div>
                </div>`
            );

            this.loadImage();

            setTimeout(this.animate.bind(this, cursor), (this.start - cursor) * 1000);

            setTimeout(this.remove.bind(this), Diaporama.removeDelay);
        }
    }

    loadImage() {
        // image is never attached to the DOM
        let i = document.createElement("img");
        i.setAttribute("src", this.file);
        let loadedAt = new Date().getTime();

        let interval = setInterval(() => {
            if (i.naturalHeight > 0) {
                let innerFrame = document.querySelector("#"+this.imageID+" .inner-frame");
                let canvas = document.createElement("canvas");
                canvas.setAttribute("id", this.imageID+"-img");
                let viewportHeight = window.visualViewport.height;
                let imageHeight = i.naturalHeight;
                let imageWidth = i.naturalWidth;

                let size = Diaporama.normalSize;
                if (this.size === "small") {
                    size = Diaporama.smallSize;
                } else if (this.size === "smaller") {
                    size = Diaporama.smallerSize;
                } else if (this.size === "big") {
                    size = Diaporama.bigSize;
                } else if (this.size === "bigger") {
                    size = Diaporama.biggerSize;
                }

                let canvasWidth, canvasHeight;
                if (imageWidth < imageHeight) {
                    canvasHeight = size * viewportHeight;
                    canvasWidth = canvasHeight * imageWidth / imageHeight;
                } else {
                    canvasWidth = size * viewportHeight;
                    canvasHeight = canvasWidth * imageHeight / imageWidth;
                }

                canvas.setAttribute("width", canvasWidth+"px");
                canvas.setAttribute("height", canvasHeight+"px");
                canvas.getContext("2d").drawImage(i, 0, 0, canvasWidth, canvasHeight);
                innerFrame.insertAdjacentElement("afterbegin", canvas);

                let sub = innerFrame.querySelector(".subtitle");
                if (sub) {
                    sub.style.setProperty("width", canvasWidth+"px");
                }

                if (Diaporama.info) {
                    document.getElementById("loadTime").innerText = (parseInt(new Date().getTime() - loadedAt))+"ms";
                }

                clearInterval(interval);

                Log.info("created canvas of", canvasWidth, "*", canvasHeight, "from picture of", imageWidth, "*", imageHeight);
            } else {
                Log.info("image not loaded yet for"+this.imageID, i);
            }
        }, 20);
    }

    animate(cursor) {
        let anim = "n"+parseInt(Math.random()*12+1);
        let i = document.getElementById(this.imageID);
        if (i) {
            i.classList.remove("hidden");
            i.querySelector(".animation-frame").classList.add(anim, "move");
        } else {
            //TODO what can be done if picture is not loaded now?
            Log.warning("too long to load image");
        }
        let actualStart = Diaporama.getCursor();
        let realDelay = parseInt((actualStart - this.start) * 1000);
        Log.info("added at", cursor, "computed start", this.start, "actual start", actualStart, "delay", realDelay, "ms");

        if (Diaporama.info) {
            document.getElementById("realDelay").innerText = realDelay+"ms";
        }
    }

    remove() {
        Log.info("remove image", this.imageID);
        let f = document.getElementById(this.imageID);
        if (f) {
            Log.info("remove HTML for", this.imageID);
            f.classList.add("hidden");
            setTimeout(() => {
                f.innerHTML = "";
            }, 1000);
            setTimeout(() => {
                Log.info("remove", this.imageID);
                f.remove();
            }, 2000);
        }
    }
}

/** Log facility */
class Log {
    static error() {
        console.error(...arguments);
    }
    static info() {
        console.info(...arguments);
    }
    static warning() {
        console.info(...arguments);
    }
    static debug() {
        console.debug(...arguments);
    }
}