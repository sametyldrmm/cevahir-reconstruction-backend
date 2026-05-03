import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';
import { USER_ROLES } from '../../users/domain/user-role.constants';

export class UpdateSuperadminUserAccountDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(Object.values(USER_ROLES))
  role?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
