import fs from "fs";
import speech from "@google-cloud/speech";
import path from "path";

class SpeechTranscriber {
  constructor(dirname) {
    this.client = new speech.SpeechClient({
      keyFilename: path.join(dirname, "rosy-spring-412418-ff0931e1d329.json"),
    });
    this.transcriptions = {};
    this.outputFilePath = path.join(
      dirname,
      "transcriptions/transcriptions.json"
    );
  }

  saveTranscriptions() {
    if (fs.existsSync(this.outputFilePath)) fs.unlinkSync(this.outputFilePath);
    fs.writeFileSync(
      this.outputFilePath,
      JSON.stringify(this.transcriptions, null, 2)
    );
  }

  async transcribeAudioStream(audioStream, index) {
    const request = {
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode: "pt-BR",
        enableAutomaticPunctuation: true,
      },
      interimResults: false,
    };

    return new Promise((resolve, reject) => {
      const recognizeStream = this.client
        .streamingRecognize(request)
        .on("error", (error) => {
          console.error("Error during streaming transcription:", error);
          reject(error);
        })
        .on("data", (data) => {
          const transcription = data.results
            .map((result) => result.alternatives[0].transcript)
            .join("\n");
          const timestamp = data.results[0].resultEndTime.seconds;
          const minutes = Math.floor(timestamp / 60);
          const seconds = timestamp % 60;
          console.log(minutes, seconds, timestamp, data.results[0].resultEndTime );
          if (!this.transcriptions[index]) {
            this.transcriptions[index] = [];
          }
          this.transcriptions[index].push({ timestamp, transcription });
        })
        .on("end", () => {
          this.saveTranscriptions();
          resolve(this.transcriptions[index]);
        });

      audioStream.pipe(recognizeStream);
    });
  }
}

export default SpeechTranscriber;
