import { BUTTON_COLUMN_CHOICES, BUTTON_SIZE_CHOICES } from '@vyaparqr/types';
import { IsIn } from 'class-validator';

import type { ButtonColumns, ButtonSize } from '@vyaparqr/types';

export class LayoutSectionDto {
  @IsIn(BUTTON_COLUMN_CHOICES)
  columns!: ButtonColumns;

  @IsIn(BUTTON_SIZE_CHOICES)
  size!: ButtonSize;
}
