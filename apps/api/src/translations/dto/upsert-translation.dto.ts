import { IsObject } from 'class-validator';

export class UpsertTranslationDto {
  @IsObject()
  content!: Record<string, Record<string, string>>;
}
