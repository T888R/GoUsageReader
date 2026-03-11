export namespace main {
	
	export class ClickResult {
	    reading: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ClickResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.reading = source["reading"];
	        this.description = source["description"];
	    }
	}

}

