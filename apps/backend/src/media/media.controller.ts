import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MediaIdParamDto } from '../common/dto/media-id-param.dto.js';
import { MediaService } from './media.service.js';
import { RequestUploadSignatureDto } from './dto/request-upload-signature.dto.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import type {
  MediaResponse,
  UploadSignatureResponse,
} from './dto/media.response.js';

@ApiTags('Media')
@ApiBearerAuth('session-auth')
@ApiSecurity('dev-user-id')
@Controller('api/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Requests signed parameters for a client-side direct upload to Cloudinary.
   */
  @ApiOperation({ summary: 'Request presigned direct upload signature' })
  @Post('signature')
  async requestSignature(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestUploadSignatureDto,
  ): Promise<UploadSignatureResponse> {
    return this.mediaService.requestSignature(userId, dto);
  }

  /**
   * Confirms a finished direct upload to Cloudinary and marks the media record READY.
   */
  @ApiOperation({ summary: 'Confirm completed upload' })
  @Post(':mediaId/confirm')
  async confirmUpload(
    @CurrentUser('id') userId: string,
    @Param() params: MediaIdParamDto,
    @Body() dto: ConfirmUploadDto,
  ): Promise<MediaResponse> {
    return this.mediaService.confirmUpload(userId, params.mediaId, dto);
  }

  /**
   * Retrieves metadata for an uploaded media asset.
   */
  @ApiOperation({ summary: 'Get media asset metadata by ID' })
  @Get(':mediaId')
  async getMedia(
    @CurrentUser('id') userId: string,
    @Param() params: MediaIdParamDto,
  ): Promise<MediaResponse> {
    return this.mediaService.getMedia(userId, params.mediaId);
  }

  /**
   * Deletes an unattached media asset.
   */
  @ApiOperation({ summary: 'Delete unattached media asset' })
  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(
    @CurrentUser('id') userId: string,
    @Param() params: MediaIdParamDto,
  ): Promise<void> {
    return this.mediaService.deleteMedia(userId, params.mediaId);
  }
}
