import { IsOptional, IsString, Matches } from 'class-validator';

export class MenuSectionDto {
  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  /** Comma-separated order types the shop accepts, e.g. "dine_in,takeaway".
   * Empty means the default: dine-in and takeaway. */
  @IsOptional()
  @IsString()
  @Matches(/^((dine_in|takeaway|delivery)(,(dine_in|takeaway|delivery))*)?$/, { message: 'Unknown order type.' })
  orderTypes?: string;
}
