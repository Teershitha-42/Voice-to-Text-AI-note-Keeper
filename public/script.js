let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const transcriptBox = document.getElementById("transcriptBox");
const tomTalkBtn = document.getElementById("tomTalkBtn");
const tomInput = document.getElementById("tomInput");
const tomImage = document.getElementById("talkingTomImg");

// 🎙 Start Recording
startBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.start();
    transcriptBox.innerText = "Listening...";
  } catch (err) {
    console.error("Mic access error:", err);
    transcriptBox.innerText = "Microphone access denied!";
  }
});

// ⏹ Stop Recording
stopBtn.addEventListener("click", async () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    try {
      const response = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const transcriptText = data.transcript?.trim() || "No speech detected.";
      transcriptBox.innerText = transcriptText;

      // 🐱 Talking Tom auto-speaks
      makeTomSpeak(transcriptText);
    } catch (err) {
      console.error("Transcription error:", err);
      transcriptBox.innerText = "Error transcribing audio.";
    }
  };
});

// 🐱 Make Tom Speak function
function makeTomSpeak(text) {
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  tomImage.classList.add("talking");

  utterance.onend = () => tomImage.classList.remove("talking");
  speechSynthesis.speak(utterance);
}

// 📌 Manual "Make Tom Talk" button
tomTalkBtn.addEventListener("click", () => {
  const text = tomInput.value.trim();
  if (text) {
    makeTomSpeak(text);
  }
});


