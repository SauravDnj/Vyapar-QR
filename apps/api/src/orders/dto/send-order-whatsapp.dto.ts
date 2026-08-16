import { IsString, MinLength } from 'class-validator';

export class SendOrderWhatsappDto {
  @IsString()
  @MinLength(1)
  message!: string;
}
