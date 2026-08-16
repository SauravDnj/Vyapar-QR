import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';

import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

@Controller('menu')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard, PlanFeatureGuard)
@RequirePermission('menu')
@RequireFeature('digitalMenu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('categories')
  listCategories(@CurrentClientId() clientId: string) {
    return this.menuService.listCategories(clientId);
  }

  @Post('categories')
  @Roles('client_admin')
  createCategory(@CurrentClientId() clientId: string, @Body() dto: CreateMenuCategoryDto) {
    return this.menuService.createCategory(clientId, dto);
  }

  @Patch('categories/:id')
  @Roles('client_admin')
  updateCategory(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateMenuCategoryDto) {
    return this.menuService.updateCategory(clientId, id, dto);
  }

  @Delete('categories/:id')
  @Roles('client_admin')
  removeCategory(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.menuService.removeCategory(clientId, id);
  }

  @Post('categories/:id/items')
  @Roles('client_admin')
  createItem(@CurrentClientId() clientId: string, @Param('id') categoryId: string, @Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(clientId, categoryId, dto);
  }

  @Patch('items/:id')
  @Roles('client_admin')
  updateItem(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuService.updateItem(clientId, id, dto);
  }

  @Delete('items/:id')
  @Roles('client_admin')
  removeItem(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.menuService.removeItem(clientId, id);
  }
}
