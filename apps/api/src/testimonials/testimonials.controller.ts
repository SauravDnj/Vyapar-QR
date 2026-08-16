import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { TestimonialsService } from './testimonials.service';

@Controller('testimonials')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(@CurrentClientId() clientId: string) {
    return this.testimonialsService.list(clientId);
  }

  @Patch(':id')
  @Roles('client_admin')
  update(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.testimonialsService.update(clientId, id, dto);
  }

  @Delete(':id')
  @Roles('client_admin')
  remove(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.testimonialsService.remove(clientId, id);
  }
}
