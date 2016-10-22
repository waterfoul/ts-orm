import {ConnectionWorker} from "../shared/ConnectionWorker";
import { Injectable, Inject } from '@angular/core';
import { Http, Response } from '@angular/http';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';

import { BaseConnection } from "../shared/BaseConnection";
import { BaseContractConstruct, BaseContract } from "../shared/BaseContract";
import { WhereOptions } from "../shared/WhereTypes";
import {API_BASE} from "../shared/index";

export interface IStorage {
	data: any;
}

@Injectable()
export class HttpConnectionWorker extends ConnectionWorker {
	constructor (
		private http: Http,
		@Inject(API_BASE) private API_BASE: string
	) { super(); }

	// TODO: figure out the typing for initial
	public create<T extends BaseContract>(
		initial: any,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/create', initial)
			.map((data: Response) => data.json())
			.map(this.createContractFn(parent, type))
			.toPromise();
	}

	public save<T extends BaseContract>(
		contract: T,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/save', (<IStorage> contract._connectionStorage).data)
			.map((data: Response) => data.json())
			.map(this.createContractFn(parent, type))
			.toPromise();
	}

	public delete<T extends BaseContract>(
		contract: T,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/delete', [contract.id])
			.toPromise();
	}

	public find<T extends BaseContract>(
		where: WhereOptions<T>,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/find', where)
			.map((data: Response) => data.json())
			.map(this.createContractFn(parent, type))
			.toPromise();
	}

	public findAll<T extends BaseContract>(
		where: WhereOptions<T>,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T[]> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/findAll', where)
			.map((data: Response) => data.json())
			.map((data: any[]) => {
				const ret: T[] = [];
				const createContract = this.createContractFn(parent, type);

				// tslint:disable-next-line:forin
				for (const i in data) {
					ret.push(createContract(data[i]));
				}

				return ret;
			})
			.toPromise();
	}

	public findById<T extends BaseContract>(
		id: number,
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): Promise<T> {
		return (<any> this.http)
			.post(this.API_BASE + '/' + this.getName(type) + '/findById', [id])
			.map((data: Response) => data.json())
			.map(this.createContractFn(parent, type))
			.toPromise();
	}

	public getField<T extends BaseContract>(contract: T, field: string): any {
		return (<IStorage> contract._connectionStorage).data[field];
	}
	public setField<T extends BaseContract>(contract: T, field: string, value: any): any {
		return (<IStorage> contract._connectionStorage).data[field] = value;
	}

	private getName<T extends BaseContract>(type: BaseContractConstruct<T>): string {
		return Reflect.getMetadata('name', type);
	}

	private createContractFn<T extends BaseContract>(
		parent: BaseConnection<T>,
		type: BaseContractConstruct<T>
	): (data: any) => T {
		return (data: any) => {
			const ret = new type(parent);
			(<IStorage> ret._connectionStorage).data = data;
			return ret;
		};
	}
}