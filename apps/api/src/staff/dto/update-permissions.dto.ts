import { IsBoolean } from 'class-validator';

export class UpdatePermissionsDto {
  @IsBoolean()
  leads!: boolean;

  @IsBoolean()
  reviews!: boolean;

  @IsBoolean()
  analytics!: boolean;

  @IsBoolean()
  billing!: boolean;

  @IsBoolean()
  domains!: boolean;

  @IsBoolean()
  whatsapp!: boolean;

  @IsBoolean()
  menu!: boolean;

  @IsBoolean()
  orders!: boolean;
}
