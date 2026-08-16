import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { SubmitTestimonialDto } from './dto/submit-testimonial.dto';
import type { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public submission from a client's landing page — starts unapproved;
   * only the client can choose which quotes show on their page. */
  async submit(slug: string, dto: SubmitTestimonialDto): Promise<void> {
    if (dto.website) {
      // Honeypot tripped — silent success, no row written.
      return;
    }

    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return;
    }

    await this.prisma.testimonial.create({
      data: {
        clientId: client.id,
        authorName: dto.authorName.trim(),
        quote: dto.quote.trim(),
        rating: dto.rating,
      },
    });
  }

  list(clientId: string) {
    return this.prisma.testimonial.findMany({ where: { clientId }, orderBy: [{ isApproved: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async update(clientId: string, id: string, dto: UpdateTestimonialDto) {
    const testimonial = await this.prisma.testimonial.findFirst({ where: { id, clientId } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(dto.isApproved !== undefined ? { isApproved: dto.isApproved } : {}),
        ...(dto.authorName !== undefined ? { authorName: dto.authorName.trim() } : {}),
        ...(dto.quote !== undefined ? { quote: dto.quote.trim() } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
    });
  }

  async remove(clientId: string, id: string): Promise<void> {
    const testimonial = await this.prisma.testimonial.findFirst({ where: { id, clientId } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }
    await this.prisma.testimonial.delete({ where: { id } });
  }
}
