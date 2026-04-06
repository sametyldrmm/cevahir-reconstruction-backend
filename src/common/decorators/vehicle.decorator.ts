import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Vehicle = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const vehicle = request.vehicle;
    return data ? vehicle?.[data] : vehicle;
  },
);

export const VehicleId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.vehicle?.id;
  },
);
