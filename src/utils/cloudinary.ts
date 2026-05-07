import { v2 as cloudinary } from 'cloudinary';
import { getEnv } from '@config/env';

export interface UploadedImage {
  url: string;
  publicId: string;
}

const env = getEnv();

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

function uploadBuffer(file: Express.Multer.File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinary.folder || 'books',
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

export async function uploadBookImages(files: Express.Multer.File[]): Promise<UploadedImage[]> {
  if (!files || files.length === 0) return [];
  const uploads = files.map((file) => uploadBuffer(file));
  return Promise.all(uploads);
}

export async function deleteCloudinaryImages(publicIds: string[]): Promise<void> {
  const uniqueIds = publicIds.filter((id, index, arr) => id && arr.indexOf(id) === index);
  if (uniqueIds.length === 0) return;

  await cloudinary.api.delete_resources(uniqueIds);
}
