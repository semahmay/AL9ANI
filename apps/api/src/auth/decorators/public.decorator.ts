import { SetMetadata } from '@nestjs/common';

import { PUBLIC_ROUTE_KEY } from '../auth.constants';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE_KEY, true);
