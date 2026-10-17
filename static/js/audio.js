/**
 * QueueSeva Multilingual Audio Synthesizer
 * Uses Web Speech API to announce tokens in hospital counters
 */

const VoiceAnnouncer = {
    synth: window.speechSynthesis,
    isSpeaking: false,

    speak: function (text, lang = "en") {
        if (!('speechSynthesis' in window)) {
            console.warn("Speech synthesis not supported in this browser.");
            return;
        }

        // Cancel any pending speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;  // Slightly measured speed for hospital clarity
        utterance.pitch = 1.0;

        // Map language
        if (lang === "hi") {
            utterance.lang = "hi-IN";
        } else if (lang === "gu") {
            utterance.lang = "gu-IN";
        } else {
            utterance.lang = "en-IN";
        }

        // Attempt voice selection
        const voices = this.synth.getVoices();
        const matchingVoice = voices.find(v => v.lang.startsWith(utterance.lang.substring(0, 2)));
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.showVisualIndicator(text);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.hideVisualIndicator();
        };

        utterance.onerror = (e) => {
            console.error("Speech synthesis error:", e);
            this.isSpeaking = false;
            this.hideVisualIndicator();
        };

        this.synth.speak(utterance);
    },

    announceToken: function (tokenNumber, roomNumber = "Room 3", lang = "en") {
        let msg = "";
        if (lang === "hi") {
            msg = `टोकन नंबर ${tokenNumber}, कृपया ${roomNumber} में पधारें।`;
        } else if (lang === "gu") {
            msg = `ટોકન નંબર ${tokenNumber}, કૃપા કરીને ${roomNumber} માં જાવ.`;
        } else {
            msg = `Attention please. Token number ${tokenNumber}, please proceed to ${roomNumber}.`;
        }
        this.speak(msg, lang);
    },

    showVisualIndicator: function (text) {
        let indicator = document.getElementById("audioBroadcastBanner");
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "audioBroadcastBanner";
            indicator.style.cssText = `
                position: fixed; top: 10px; right: 20px; z-index: 9999;
                background: #0284c7; color: white; padding: 10px 20px;
                border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                display: flex; align-items: center; gap: 10px; font-weight: 600;
            `;
            document.body.appendChild(indicator);
        }
        indicator.innerHTML = `<span>🔊 Broadcasting:</span> <span>"${text}"</span>`;
        indicator.style.display = "flex";
    },

    hideVisualIndicator: function () {
        const indicator = document.getElementById("audioBroadcastBanner");
        if (indicator) {
            setTimeout(() => {
                indicator.style.display = "none";
            }, 1000);
        }
    }
};

// Pre-load voices on browser ready
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
