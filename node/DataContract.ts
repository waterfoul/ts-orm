// DO NOT REMOVE THIS IMPORT it is required for this file to function
// tslint:disable-next-line:no-unused-variable
import * as reflectMetadata from 'reflect-metadata';
import * as Sequelize from 'sequelize';
import * as moment from 'moment';
import * as _ from 'lodash';

import { field } from './field';
import { Types } from '../shared/Types';
import { IDataContract } from '../shared/DataObject';
import { logger, connection } from './connect';
import { OneToOne } from './relationships/OneToOne';
import { ManyToOne } from './relationships/ManyToOne';
import { OneToMany } from './relationships/OneToMany';
import { Relationship } from './relationships/Relationship';

export interface IDataContractConstruct<T extends DataContract> {
	new (
		instance: any
	): T;
	getContractName(): string;
	getSequelizeModel(relationships?: boolean): Promise<Sequelize.Model<any, any>>;
	isFirst(dest: IDataContractConstruct<any>): boolean;
}

type DataContractType = typeof DataContract;

export enum getFieldsSources {
	save,
	toJSON
};

export const needsCreate: {
	type: IDataContractConstruct<DataContract>
	items: DataContract[]
}[][] = (<any> []);

export abstract class DataContract implements IDataContract {
	public static moduleName: string;
	public static name: string;
	public static relationshipsSetup: boolean = false;
	public static relationshipsSetupList: any[] = [];

	public static getContractName(): string {
		return this.moduleName + this.name;
	}

	public static getSequelizeModel(): Promise<Sequelize.Model<any, any>> {
		if (DataContract.models[this.moduleName] === undefined) {
			DataContract.models[this.moduleName] = {};
		}
		if (DataContract.models[this.moduleName][this.name] === undefined) {
			DataContract.models[this.moduleName][this.name] = this
				.getBaseModel()
				.then(this.setupRelationships.bind(this))
				.then((model: Sequelize.Model<any, any>) => {
					DataContract.addModelSync(model);
					return model;
				});
		}
		return DataContract.models[this.moduleName][this.name]
			.then((contract) => DataContract.syncAll()
				.then(() => contract)
			);
	}

	public static isFirst(dest: IDataContractConstruct<any>) {
		return this.getContractName().localeCompare(dest.getContractName()) > 0;
	}

	private static models: {
		[moduleName: string]: {
			[contractName: string]: Promise<Sequelize.Model<any, any>>;
		}
	} = {};

	private static needsSync: Sequelize.Model<any, any>[] = [];

	private static addModelSync(model: Sequelize.Model<any, any>) {
		_.remove(DataContract.needsSync, (o: any) => o.name === (<any> model).name);
		DataContract.needsSync.push(model);
	}

	private static getBaseModel(): Promise<Sequelize.Model<any, any>> {
		return new Promise((resolve, reject) => {
			try {
				const constructor: any = this;
				const instance: DataContract = (new constructor(null, null));
				const fields = instance.fields;
				const model: any = {};
				_.forEach(fields, (fieldName) => {
					const type: Types = Reflect.getMetadata(
						'ORM:type',
						instance,
						fieldName
					);

					switch (type) {
						case Types.string:
							model[fieldName] = {
								type: Sequelize.STRING
							};
							break;
						case Types.float:
							model[fieldName] = {
								type: Sequelize.FLOAT
							};
							break;
						case Types.integer:
							model[fieldName] = {
								type: Sequelize.INTEGER
							};
							break;
						case Types.bigInt:
							model[fieldName] = {
								type: Sequelize.BIGINT
							};
							break;
						case Types.dateTimeTz:
							model[fieldName] = {
								type: Sequelize.DATE
							};
							break;
						case Types.relationshipOneToOne:
						case Types.relationshipOneToMany:
						case Types.relationshipManyToOne:
							break;
						default:
							throw new TypeError(
								'Field of unknown type found! ' +
								'Field Name:' + fieldName + ' ' +
								'Field Type: ' + type
							);
					}
				});
				const contract = connection.define(
					this.getContractName(),
					model,
					{
						freezeTableName: true // Model tableName will be the same as the model name
					}
				);
				resolve(contract);
			} catch (e) {
				reject(e);
			}
		});
	}

	private static setupRelationships(thisModel): Promise<Sequelize.Model<any, any>> {
		const constructor: any = this;
		const instance: DataContract = (new constructor(null, null));
		const fields = instance.fields;
		const relationships: Promise<any>[] = [];

		this.relationshipsSetup = true;

		try {

			_.forEach(fields, (fieldName) => {
				const type: Types = Reflect.getMetadata(
					'ORM:type',
					instance,
					fieldName
				);
				const relatedTypeFn: () => IDataContractConstruct<any> =
					Reflect.getMetadata(
						'ORM:relatedType',
						instance,
						fieldName
					);
				// This can get called before everything is setup properly so we need to skip those that haven't fully
				// loaded yet
				if (relatedTypeFn && this.relationshipsSetupList.indexOf(relatedTypeFn) === -1) {
					this.relationshipsSetupList.push(relatedTypeFn);

					const relatedType: IDataContractConstruct<any> = relatedTypeFn();

					relationships.push((<any> relatedType).getBaseModel().then((relatedModel) => {

						// tslint:disable-next-line:switch-default
						switch (type) {
							case Types.relationshipOneToOne:
								OneToOne.addRelationship(
									<any> this,
									thisModel,
									relatedType,
									relatedModel
								);
								break;
							case Types.relationshipManyToOne:
								ManyToOne.addRelationship(
									thisModel,
									relatedModel
								);
								break;
							case Types.relationshipOneToMany:
								OneToMany.addRelationship(
									thisModel,
									relatedModel
								);
								break;
						}

						DataContract.addModelSync(relatedModel);
					}));
				} else {
					this.relationshipsSetup = false;
				}
			});

			return Promise.all(relationships).then(() => thisModel);
		} catch (e) {
			/* istanbul ignore next */
			return <any> Promise.reject(e);
		}
	}

	private static syncAll(): Promise<void> {
		const syncList = DataContract.needsSync;
		DataContract.needsSync = [];
		const syncs: Promise<any>[] = [];
		// tslint:disable-next-line:forin
		for (const i in syncList) {
			syncs.push(syncList[i].sync());
		}
		return Promise.all(syncs).then(() => { /* */ });
	}

	private get fields(): string[] {
		return Reflect.getMetadata('ORM:fields', this);
	}

	@field()
	public id: number;
	@field(Types.dateTimeTz)
	public createdAt: moment.Moment;
	@field(Types.dateTimeTz)
	public updatedAt: moment.Moment;

	constructor(
		private instance: any
	) {}

	public loadData(data: any): void {
		const fields: string[] = this.fields;
		for (const i in fields) {
			if (data[fields[i]] !== undefined) {
				// TODO: validation
				const type: Types = Reflect.getMetadata('ORM:type', this, fields[i]);
				const hidden: boolean = Reflect.getMetadata('ORM:hidden', this, fields[i]);

				logger.info(
					'DataContract',
					(<any> this.constructor).name,
					'.',
					fields[i],
					'type',
					type,
					'hidden',
					hidden
				);

				switch (type) {
					case(Types.dateTimeTz):
						this[fields[i]] = moment(data[fields[i]]);
						break;
					default:
						this[fields[i]] = data[fields[i]];
				}
			}
		}
	}

	public serialize(): string {
		return JSON.stringify(this.toJSON());
	}

	public save(t?: Sequelize.Transaction): Promise<this> {
		return this.internalSave(true, t);
	}

	public delete(): Promise<void> {
		if (this.instance) {
			return this.instance.destroy();
		} else {
			return <any> Promise.resolve();
		}
	}

	public getFields(reqSrc: getFieldsSources): any {
		let returnObj: any = {};
		const fields: string[] = this.fields;
		_.forEach(fields, (fieldName: string) => {
			const value: any = this[fieldName];

			const type: Types = Reflect.getMetadata('ORM:type', this, fieldName);
			const hidden: boolean = Reflect.getMetadata('ORM:hidden', this, fieldName);

			if (!hidden) {
				switch (type) {
					case(Types.dateTimeTz):
						returnObj[fieldName] = value && value.toISOString();
						break;
					case(Types.relationshipOneToOne):
						if (value) {
							returnObj = (<OneToOne<any>> value).setField(returnObj, reqSrc);
						}
						break;
					case(Types.relationshipManyToOne):
						if (value) {
							returnObj = (<ManyToOne<any>> value).setField(returnObj, reqSrc);
						}
						break;
					case(Types.relationshipOneToMany):
						// Data is not stored in this object so do nothing
						break;
					default:
						returnObj[fieldName] = value;
				}
			}
		});
		return returnObj;
	}

	private internalSave(saveRelated: boolean, t: any): Promise<this> {
		if (this.instance) {
			let ret: Promise<any>;
			ret = this.seedIds(t).then(() => this.instance.save());
			if (saveRelated) {
				ret = ret.then(() => this.saveDependants());
			} else {
				ret = this.instance.save(t);
			}
			return ret.then(() => this);
		} else {
			let ret: Promise<any> = this.seedIds(t)
				.then(() => (<DataContractType> this.constructor).getSequelizeModel());

			if (t) {
				const name = (<IDataContractConstruct<this>> this.constructor).getContractName();
				if (!needsCreate[t.name]) {
					needsCreate[t.name] = <any> [];
				}
				if (!needsCreate[t.name][name]) {
					needsCreate[t.name][name] = {
						items: (<DataContract[]> []),
						type: (<IDataContractConstruct<this>> this.constructor)
					};
				}
				needsCreate[t.name][name].items.push(this);
			} else {
				ret = ret.then((model: Sequelize.Model<any, any>) => {
					return model.create(this.getFields(getFieldsSources.save));
				}).then((sqlData: any) => {
					this.instance = sqlData;
				});
			}
			if (saveRelated) {
				return ret.then(() => this.saveDependants());
			}
			return ret.then(() => this);
		}
	}

	private toJSON(): any {
		const returnObj: any = this.getFields(getFieldsSources.toJSON);
		returnObj.id = this.id;
		returnObj.createdAt = this.createdAt && this.createdAt.toISOString();
		returnObj.updatedAt = this.updatedAt && this.updatedAt.toISOString();
		return returnObj;
	}

	private seedIds(t: Sequelize.Transaction): Promise<any> {
		const promises: Promise<any>[] = [];

		const fields: string[] = this.fields;
		_.forEach(fields, (fieldName: string) => {
			const type: Types = Reflect.getMetadata('ORM:type', this, fieldName);
			const value: any = this[fieldName];

			// tslint:disable-next-line:switch-default
			switch (type) {
				case(Types.relationshipOneToOne):
				case(Types.relationshipManyToOne):
					promises.push((<Relationship<any, any>> value).seedIds(t));
					break;
			}
		});

		return Promise.all(promises);
	}

	private saveDependants(): Promise<any> {
		const promises: Promise<any>[] = [];

		const fields: string[] = this.fields;
		_.forEach(fields, (fieldName: string) => {
			const type: Types = Reflect.getMetadata('ORM:type', this, fieldName);
			const value: any = this[fieldName];

			// tslint:disable-next-line:switch-default
			switch (type) {
				case(Types.relationshipOneToOne):
				case(Types.relationshipManyToOne):
					promises.push((<Relationship<any, any>> value).saveRelated());
					break;
			}
		});

		return Promise.all(promises);
	}
}
