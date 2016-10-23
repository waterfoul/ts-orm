import {Types} from "./Types";
import {BaseConnection} from "./BaseConnection";
import {BaseContractConstruct} from "./BaseContract";
import {RemoteKeys} from "./RemoteKeys";
import {ForeignKey} from "./ForeignKey";
import {RemoteKey} from "./RemoteKey";

let appRoot: string[] = null;

export function setAppRoot(root: string | string[]) {
	if (!Array.isArray(root)) {
		root = <any> [root];
	}

	appRoot = <any> root;
}

function extractPath(stackLine: string) {
	let splitStack = stackLine.split(':')
	let path = splitStack.splice(0, splitStack.length - 2).join(':');
	if (path.match(/\(/)) {
		path = path.split('(')[1];
	} else {
		const pathArr = path.split(' ');
		path = pathArr[pathArr.length - 1];
	}
	return path;
}

function notAtSource(stackLine) {
	if (stackLine === 'Error') {
		return true;
	}
	const path = extractPath(stackLine);
	if (
		path.match(/shared\/Field[.][jt]s$/) ||
		path.match(/reflect-metadata\/[^\/]+[.]js$/)
	) {
		return true;
	}
	return false;
}

function stripAppRoot(path) {
	// tslint:ignore-next-line:forin
	for (const i in appRoot) {
		if (path.substring(0, appRoot[i].length) === appRoot[i]) {
			return path.substring(appRoot[i].length).replace(/^[/]*/, '');
		}
	}

	return path;
}

export interface IFieldConfig {
	type?: Types;
	related?: () => BaseContractConstruct<any>;
	unique?: boolean;
	allowNull?: boolean;
	// TODO: Make this match the datatype of the field
	defaultValue?: any;
	remoteField?: any;
}

export function Field(config?: IFieldConfig) {
	config = config || {};

	return (target, propertyName: string) => {
		// Build the object's "name" if it doesn't exist
		if (!Reflect.getMetadata('name', target.constructor)) {
			const stack = (<any> new Error()).stack.replace(/\r/g, '').split('\n');
			let pathLocation = 0;
			while (notAtSource(stack[pathLocation])) {
				pathLocation++;
			}
			let path = extractPath(stack[pathLocation]);
			if (appRoot === null) {
				throw Error('You must set the appRoot!');
			}
			path = stripAppRoot(path).replace(/[.][tj]s$/, '').replace(/[/.]/g, '$');
			Reflect.defineMetadata('name', path, target.constructor);
		}

		if (!config.type) {
			// Update the fields array with the info about this field
			const jsType: any = Reflect.getMetadata('design:type', target, propertyName);
			switch (jsType.name) {
				case 'String':
					config.type = Types.string;
					break;
				case 'Number':
					config.type = Types.float;
					break;
				case 'Object':
					throw new TypeError('Automatic mapping of Objects is unsupported');
				default:
					if (jsType === RemoteKeys) {
						config.type = Types.remoteKeys;
					} else if (jsType === ForeignKey) {
						config.type = Types.foreignKey;
					} else {
						throw new TypeError('Unknown js type found! ' + jsType.name);
					}
			}
		}

		const fields = Reflect.getMetadata('fields', target.constructor) || {};
		fields[propertyName] = config;
		Reflect.defineMetadata('fields', fields, target.constructor);

		// Delete property.
		if (delete target[propertyName]) {

			switch (config.type) {
				case Types.remoteKeys:
					let remoteValues: RemoteKeys<any> = null;
					// Create new property with getter and setter
					Object.defineProperty(target, propertyName, {
						configurable: false,
						enumerable: true,
						get: function () {
							if (!remoteValues) {
								remoteValues = new RemoteKeys<any>(this, this.parent, config.remoteField, config.related());
							}
							return remoteValues;
						}
					});
					break;
				case Types.remoteKey:
					let remoteValue: RemoteKey<any> = null;
					// Create new property with getter and setter
					Object.defineProperty(target, propertyName, {
						configurable: false,
						enumerable: true,
						get: function () {
							if (!remoteValue) {
								remoteValue = new RemoteKey<any>(this, this.parent, config.remoteField, config.related());
							}
							return remoteValue;
						}
					});
					break;
				case Types.foreignKey:
					let foreignValue: ForeignKey<any> = null;
					// Create new property with getter and setter
					Object.defineProperty(target, propertyName, {
						configurable: false,
						enumerable: true,
						get: function () {
							if (!foreignValue) {
								foreignValue = new ForeignKey(this, this.parent, propertyName, config.related());
							}
							return foreignValue;
						}
					});
					break;
				default:
					// Create new property with getter and setter
					Object.defineProperty(target, propertyName, {
						configurable: false,
						enumerable: true,
						get: function () {
							return (<BaseConnection<any>> this.parent).getField(this, propertyName);
						},
						set: function (value: any) {
							return (<BaseConnection<any>> this.parent).setField(this, propertyName, value);
						}
					});
			}
		}
	};
}
