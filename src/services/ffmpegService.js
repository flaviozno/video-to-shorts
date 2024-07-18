import ffmpeg from "fluent-ffmpeg";
import { exec } from "child_process";
import path from "path";
import SpeechTranscriber from "./speechService.js";
import fs from "fs";

const FFmpegPath = "C:\\ffmpeg\\bin\\ffmpeg.exe";
ffmpeg.setFfmpegPath(FFmpegPath);

class ffmpegService {
  constructor(dirname) {
    this.speech = new SpeechTranscriber(dirname);
    this.__dirname = dirname;
  }

  async resize(outputVideo) {
    const outputFile = path.resolve(this.__dirname, "download", "resize.mp4");
    const ffmpegCommand = `ffmpeg -i ${outputVideo} -filter_complex "[0:v]boxblur=30,scale=1080x1920,setsar=1[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=y=(H-h)/2" -c:v h264_nvenc -preset fast -y ${outputFile}`;
    return new Promise((resolve, reject) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        resolve(outputFile);
      });
    });
  }

  async syncAudio(outputVideo, outputAudio) {
    const outputFile = path.resolve(this.__dirname, "download", "final.mp4");

    return new Promise((resolve, reject) => {
      ffmpeg(outputVideo)
        .addInput(outputAudio)
        .videoCodec("h264_nvenc")
        .on("end", () => resolve(outputFile))
        .on("error", (err) => reject(err))
        .save(outputFile);
    });
  }

  async syncTranscriptions(startTime, segmentDuration, outputAudio, index) {
    return new Promise((resolve, reject) => {
      const audioSegmentPath = path.resolve(
        this.__dirname,
        "temp",
        `audio_segment_${index}.wav`
      );

      ffmpeg(outputAudio)
        .setStartTime(startTime)
        .setDuration(segmentDuration)
        .audioChannels(1)
        .audioFrequency(16000)
        .format("wav")
        .save(audioSegmentPath)
        .on("end", async () => {
          const audioStream = fs.createReadStream(audioSegmentPath);
          try {
            const transcriptions = await this.speech.transcribeAudioStream(
              audioStream,
              index
            );
            const drawtextFilters = transcriptions.map((item) => {
              return {
                filter: "drawtext",
                options: {
                  fontfile: "Arial",
                  text: item.transcription,
                  fontsize: 48,
                  fontcolor: "yellow",
                  borderw: 2,
                  bordercolor: "black",
                  x: "(main_w/2-text_w/2)",
                  y: "main_h-150",
                  shadowcolor: "black",
                  shadowx: 3,
                  shadowy: 3,
                  // enable: `between(t,02,01)`,
                  // enable: `between(t,${item.timestamp},${
                  //   Number(item.timestamp) + 2
                  // })`,
                },
              };
            });
            resolve(drawtextFilters);
          } catch (err) {
            reject(err);
          } finally {
            fs.unlinkSync(audioSegmentPath);
          }
        })
        .on("error", (err) => {
          console.error(`Error creating audio segment ${index + 1}:`, err);
          reject(err);
        });
    });
  }

  async createSegment(
    videoPath,
    startTime,
    segmentDuration,
    outputFilePath,
    index,
    audioPath,
    audioVolume = 0.15,
    outputAudio
  ) {
    // let drawtextFilters = await this.syncTranscriptions(
    //   startTime,
    //   segmentDuration,
    //   outputAudio,
    //   index
    // );
    // console.log(drawtextFilters);
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(segmentDuration)
        .videoCodec("h264_nvenc")
        .addInput(audioPath)
        .complexFilter([
          {
            filter: "volume",
            options: audioVolume,
            inputs: "[1]",
            outputs: "a1",
          },
          {
            filter: "amix",
            options: { inputs: 2, duration: "first" },
            inputs: ["[0]", "a1"],
            outputs: "aout",
          },
        ])
        // .videoFilters([...drawtextFilters])
        .outputOptions([
          "-map",
          "0:v",
          "-map",
          "[aout]",
          "-pix_fmt",
          "yuv420p",
          "-preset",
          "fast",
          "-loglevel",
          "verbose",
        ])
        .output(outputFilePath)
        .on("end", () => {
          console.log(`Segment ${index + 1} created: ${outputFilePath}`);
          resolve(outputFilePath);
        })
        .on("error", (err) => {
          console.error(`Error creating segment ${index + 1}:`, err);
          reject(err);
        })
        .run();
    });
  }

  async splitVideo(videoPath, outputAudio) {
    const segmentDuration = 59;
    const outputDir = path.resolve(this.__dirname, "shorts");
    const audioMusicDir = path.resolve(this.__dirname, "audios/default.mp3");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) {
          console.error("Error retrieving video metadata:", err);
          return reject(err);
        }

        const duration = metadata.format.duration;
        const numSegments = Math.ceil(duration / segmentDuration);

        const segmentPromises = [];

        for (let i = 0; i < numSegments; i++) {
          const startTime = i * segmentDuration;
          const outputFilePath = path.join(outputDir, `short_${i + 1}.mp4`);
          const segmentPromise = this.createSegment(
            videoPath,
            startTime,
            segmentDuration,
            outputFilePath,
            i,
            audioMusicDir,
            0.25,
            outputAudio
          ).catch((err) => {
            console.error(`Error processing segment ${i + 1}`, err);
          });
          segmentPromises.push(segmentPromise);
        }
        Promise.all(segmentPromises)
          .then(() => {
            console.log("All shorts created successfully.");
            resolve();
          })
          .catch(reject);
      });
    });
  }
}

export default ffmpegService;
