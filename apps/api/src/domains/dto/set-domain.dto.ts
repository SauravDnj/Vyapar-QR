import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** Bare hostname only — no protocol, no path, no port. */
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export class SetDomainDto {
  @IsString()
  @IsNotEmpty()
  @Matches(HOSTNAME_PATTERN, { message: 'Enter a bare domain, e.g. shop.example.com (no https:// or path).' })
  domain!: string;
}
