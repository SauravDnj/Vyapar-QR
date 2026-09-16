import { IsString, MaxLength } from 'class-validator';

export class CheckReviewLinkDto {
  @IsString()
  @MaxLength(1000)
  url!: string;
}
