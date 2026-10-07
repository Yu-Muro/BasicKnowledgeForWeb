export interface IMigrationStateRepository {
    isDepartmentMigrationPending(): Promise<boolean>;
}
