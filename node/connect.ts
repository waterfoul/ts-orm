import * as Sequelize from 'sequelize';

export let connection: any;

export function connect(database: string, username: string, password: string, options?: Sequelize.Options) {
	connection = new Sequelize(database, username, password, options);
}
