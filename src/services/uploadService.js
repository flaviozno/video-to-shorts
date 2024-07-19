import fs from "fs";
import path from "path";

class UploadService {
  constructor(dirname, youtube) {
    this.__dirname = dirname;
    this.youtube = youtube;
  }

  async uploadVideo(
    videoPath,
    description,
    title,
    tags,
    status,
    categoryId = 22
  ) {
    const videoFileSize = fs.statSync(
      path.join(this.__dirname, `shorts/${videoPath}`)
    ).size;
    const request = {
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: tags,
          defaultLanguage: "pt-BR",
          defaultAudioLanguage: "pt-BR",
          categoryId: categoryId,
        },
        status: {
          privacyStatus: status,
        },
      },
      media: {
        body: fs.createReadStream(
          path.join(this.__dirname, `shorts/${videoPath}`)
        ),
      },
    };

    const onUploadProgress = (event) => {
      const progress = Math.round((event.bytesRead / videoFileSize) * 100);
      console.log(`${videoPath} was ${progress}% completed!`);
    };

    try {
      const response = await this.youtube.videos.insert(request, {
        onUploadProgress,
      });
      console.log(
        `Your video was successfully uploaded: https://youtu.be/${response.data.id}`
      );
      return true;
    } catch (error) {
      console.error("Error uploading video:", error);
      return false;
    }
  }
}

export default UploadService;
