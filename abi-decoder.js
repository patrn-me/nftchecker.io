// note: this does not validate if the string is actually hex
export function bytes_from_hex(s) {
	if (typeof s !== 'string') throw new TypeError('expected string');
	let {length} = s;
	if (length & 1) throw new TypeError('expected string of even length');
	let pos = s.startsWith('0x') ? 2 : 0;
	let v = new Uint8Array((length - pos) >> 1);
	for (let i = 0; i < v.length; i++) {
		let x = parseInt(s.slice(pos, pos += 2), 16);
		if (Number.isNaN(x)) throw new TypeError('expected hex string');
		v[i] = x;
	}
	return v;
}

export function number_from(x) {
	if (typeof x === 'string') {
		if (/^(0x)?[a-f0-9]{0,12}$/i.test(x)) return parseInt(x, 16); // is this a fast path?
		x = this.bytes_from_hex(x);
	} else if (Array.isArray(x)) {
		x = Uint8Array.from(x);
	} else if (ArrayBuffer.isView(x)) {
		x = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
	} else if (x instanceof ArrayBuffer) {
		x = new Uint8Array(x, 0, x.byteLength);			
	} else {
		throw new TypeError('unknown number to byte conversion');
	}
	if (x.length > 7) {  // 53 bits => 7 bytes, so everything else must be 0
		let n = x.length - 7;
		for (let i = 0; i < n; i++) if (x[i] > 0) throw new RangeError('overflow');
		x = x.subarray(n);
	}
	let n = 0;
	for (let i of x) n = (n << 8) | i;
	return n;
}

export class ABIDecoder {
	static from_hex(x) { return new this(bytes_from_hex(x)); }
	constructor(buf) {
		this.buf = buf;
		this.pos = 0;
	}
	read(n) {
		let {pos, buf} = this;
		let end = pos + n;
		if (end > buf.length) throw new Error('overflow');
		let v = buf.subarray(pos, end);
		this.pos = end;
		return v;
	}
	number(n = 32) { return number_from(this.read(n)); }
	string() {
		let pos = this.number();
		let end = pos + 32;
		let {buf} = this;
		if (end > buf.length) throw new RangeError('overflow');
		let len = number_from(buf.subarray(pos, end));
		pos = end;
		end += len;
		if (end > buf.length) throw new RangeError('overflow');
		return String.fromCharCode.apply(null, buf.subarray(pos, end));
	}
}

