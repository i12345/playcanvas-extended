import { http } from '../../platform/net/http.js';

class ShaderHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "shader";

    constructor(app) {
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        http.get(url.load, {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, function (err, response) {
            if (!err) {
                callback(null, response);
            } else {
                callback(`Error loading shader resource: ${url.original} [${err}]`);
            }
        });
    }

    open(url, data) {
        return data;
    }

    patch(asset, assets) {
    }
}

export { ShaderHandler };
