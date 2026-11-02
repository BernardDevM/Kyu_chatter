import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? 'kyu-chat';
    this.apiKey = process.env.CLOUDINARY_API_KEY ?? '123456789012345';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET ?? 'mock-api-secret';

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  getCloudName(): string {
    return this.cloudName;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  signUploadParameters(params: Record<string, string | number>): string {
    return cloudinary.utils.api_sign_request(params, this.apiSecret);
  }

  async deleteResource(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result?.result === 'ok';
    } catch (err: any) {
      this.logger.warn(
        `Failed to destroy Cloudinary asset "${publicId}": ${err.message}`,
      );
      return false;
    }
  }
}
