import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const SEND_MODES = ['auto', 'api', 'url'] as const;

export class UpdateWhatsappSettingsDto {
  @IsBoolean()
  isEnabled!: boolean;

  @IsBoolean()
  aiChatbotEnabled!: boolean;

  @IsOptional()
  @IsString()
  systemPromptOverride?: string | null;

  @IsOptional()
  @IsIn(SEND_MODES)
  sendMode?: (typeof SEND_MODES)[number];
}
