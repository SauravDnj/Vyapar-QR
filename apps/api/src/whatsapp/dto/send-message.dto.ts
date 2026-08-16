import { IsString, MinLength } from 'class-validator';

export class SendWhatsappMessageDto {
  @IsString()
  @MinLength(3)
  phone!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
