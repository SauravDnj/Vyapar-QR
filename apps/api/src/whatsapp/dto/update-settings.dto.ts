import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWhatsappSettingsDto {
  @IsBoolean()
  isEnabled!: boolean;

  @IsBoolean()
  aiChatbotEnabled!: boolean;

  @IsOptional()
  @IsString()
  systemPromptOverride?: string | null;
}
