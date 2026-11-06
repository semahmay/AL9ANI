import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../generated/prisma/enums';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  @Get('ping')
  @ApiOperation({ summary: 'Admin-only authorization test endpoint' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        message: 'Admin access granted.',
        user: { id: '00000000-0000-0000-0000-000000000000', role: 'ADMIN' },
      },
    },
  })
  ping(@CurrentUser() user: AuthenticatedUser): {
    status: 'ok';
    message: string;
    user: AuthenticatedUser;
  } {
    return {
      status: 'ok',
      message: 'Admin access granted.',
      user,
    };
  }
}
