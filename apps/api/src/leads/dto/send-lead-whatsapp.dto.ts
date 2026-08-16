import { IsString, MinLength } from 'class-validator';

export class SendLeadWhatsappDto {
  @IsString()
  @MinLength(1)
  message!: string;
}
