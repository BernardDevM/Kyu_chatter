import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { CloudinaryService } from './cloudinary.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, CloudinaryService]
})
export class MediaModule {}
