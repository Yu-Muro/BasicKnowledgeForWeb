import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type { CreateUserInput } from '@backend/src/infrastructure/validators/userValidator';
import bcrypt from 'bcryptjs';
import { hasDatabaseError } from '../databaseErrors';
import type { ICreateUserUseCase } from './ICreateUserUseCase';

export class CreateUserUseCase implements ICreateUserUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly departmentRepository: IDepartmentRepository,
    ) {}

    async execute(input: CreateUserInput) {
        try {
            if (!(await this.departmentRepository.findById(input.departmentId)))
                return {
                    success: false as const,
                    error: '部署が見つかりません',
                };
            const existingUser = await this.userRepository.findByEmail(
                input.email,
            );
            if (existingUser) {
                return {
                    success: false as const,
                    error: 'このメールアドレスは既に使用されています',
                };
            }

            const hashedPassword = await bcrypt.hash(input.password, 12);
            const newUser = await this.userRepository.create({
                name: input.name,
                email: input.email,
                password: hashedPassword,
                role: 'user',
                departmentId: input.departmentId,
            });

            return {
                success: true as const,
                data: (({ password: _password, ...user }) => user)(newUser),
            };
        } catch (error) {
            return {
                success: false as const,
                error: hasDatabaseError(error, '23505')
                    ? 'このメールアドレスは既に使用されています'
                    : hasDatabaseError(error, '23503')
                      ? '有効な部署を指定してください'
                      : 'ユーザーの作成に失敗しました',
            };
        }
    }
}
