import ffmpeg from "fluent-ffmpeg";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

const FFmpegPath = "C:\\ffmpeg\\bin\\ffmpeg.exe";
ffmpeg.setFfmpegPath(FFmpegPath);

class ffmpegService {
  constructor(dirname) {
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
  splitText(text, maxLength = 34) {
    const words = text.split(" ");
    let lines = [];
    let currentLine = "";

    words.forEach((word) => {
      if ((currentLine + word).length <= maxLength) {
        currentLine += `${word} `;
      } else {
        lines.push(currentLine.trim());
        currentLine = `${word} `;
      }
    });

    if (currentLine.length > 0) {
      lines.push(currentLine.trim());
    }

    return lines.join("\n");
  }
  getTranscription(srtFilePath, startTime, segmentDuration) {
    const srtContent = JSON.parse(fs.readFileSync(srtFilePath, "utf-8"));
    let transcriptions = [];
    srtContent.segments.map((block) => {
      if (
        block.start >= startTime &&
        block.end <= startTime + segmentDuration
      ) {
        const text = this.splitText(block.text.trim());
        transcriptions.push({
          start: block.start,
          end: block.end,
          text: text,
        });
      }
    });
    return transcriptions;
  }

  async createSegment(
    videoPath,
    startTime,
    segmentDuration,
    outputFilePath,
    index,
    audioPath,
    audioVolume = 0.8,
    srtPath
  ) {
    const subtitles = this.getTranscription(
      path.join(this.__dirname, `transcription/${srtPath}`),
      startTime,
      segmentDuration
    );
    const drawtextFilters = subtitles.map((subtitle) => ({
      filter: "drawtext",
      options: {
        fontfile: "Montserrat-Bold",
        text: subtitle.text,
        fontsize: 48,
        fontcolor: "yellow",
        borderw: 2,
        bordercolor: "black",
        x: "(((main_w/2)-10)-((text_w/2)-10))",
        y: "main_h-190",
        shadowcolor: "black",
        shadowx: 3,
        shadowy: 3,
        enable: `between(t,${subtitle.start - startTime},${
          subtitle.end - startTime
        })`,
      },
    }));
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
        .videoFilters([...drawtextFilters])
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

  async splitVideo(videoPath, srtPath) {
    const segmentDuration = 60;
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
            srtPath
          ).catch((err) => {
            console.error(`Error processing segment ${i + 1}`, err);
          });
          segmentPromises.push(segmentPromise);

          if (segmentPromises.length === 2 || i === numSegments - 1) {
            await Promise.all(segmentPromises);
            segmentPromises.length = 0;
          }
        }
        console.log("All shorts created successfully.");
        resolve();
      });
    });
  }
}

export default ffmpegService;
