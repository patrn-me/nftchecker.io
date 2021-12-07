// ens-resolver.js
// raffy.eth
//
// *** THIS IS UNDER DEVELOPMENT ***
//
// note: all addresses are returned with checksum
//
// checksum_address(address:string:(0x)?hex[40]) 
//   throws if not an address
//   returns address:string:0x+hex[40]
//
// ens_labelhash(string)
// ens_namehash(string)
//   input should be normalized
//   returns hash:string:hex[64]
//
// TODO: add check callable
// async_request_provider should be a callable:
//   eg. window.ethereum.request or provider.sendAsync
//   ie. a function that makes an ethereum JSON-RPC call
// 
// async ens_resolve_namehash(async_request_provider, namehash:string:(0x)?hex[64])
//   throws on error
//   returns {resolver:string:0x+hex[40], address:string:0x+hex[40] or false (not set)} 
//   
// async ens_name_from_address(async_request_provider, address:string:(0x)?hex[40])
//   throws on error
//   returns {resolver:string;:0x+hex[40], address:string:0x+hex[40], name:string or false (not set)}

import {keccak} from 'https://unpkg.com/@adraffy/keccak@1.1.2/dist/keccak.min.js';

export function ens_labelhash(label) {
	return keccak().update(label).hex;
}

export function ens_namehash(name) {
	if (typeof name !== 'string') throw new TypeError('Expected string');
	let buf = new Uint8Array(64); 
	if (name.length > 0) {
		for (let label of name.split('.').reverse()) {
			buf.set(keccak().update(label).bytes, 32);
			buf.set(keccak().update(buf).bytes, 0);
		}        
	}
	return [...buf.subarray(0, 32)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function validate_hex(n, s) {
	if (typeof s !== 'string') return;      // check type
	if (s.startsWith('0x')) s = s.slice(2); // optional
	if (s.length != n) return;              // check length
	if (!/^[a-f0-9]*/i.test(s)) return;     // check hex
	return s;
}

// accepts address (0x-prefix is optional)
// returns 0x-prefixed checksum address 
export function checksum_address(s) {
	s = validate_hex(40, s);
	if (!s) throw new TypeError('Expected Ethereum address');
	let v = keccak().update(s.toLowerCase()).hex; // checksum
	return '0x' + [...s].map((x, i) => v[i].charCodeAt(0) >= 56 ? x.toUpperCase() : x).join(''); 
}

// ens registry contract
// https://docs.ens.domains/ens-deployments
const ENS_CONTRACT = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; 
const resolver_SIG = '0x0178b8bf'; // resolver(bytes32)

// https://eips.ethereum.org/EIPS/eip-137
export async function ens_resolve_namehash(async_request_provider, namehash) {
	namehash = validate_hex(64, namehash);
	if (!namehash) throw new TypeError('Invalid namehash');
	let resolver = validate_hex(64, await async_request_provider({method: 'eth_call', params:[{to: ENS_CONTRACT, data: resolver_SIG + namehash}, 'latest']}));
	if (!resolver) throw new TypeError('Invalid ABI Response from ENS Registry');
	resolver = checksum_address(resolver.slice(24));
	let address = false;
	if (!/^0x[0]+$/.test(resolver)) {
		const addr_SIG = '0x3b3b57de'; // addr(bytes32)
		address = validate_hex(64, await async_request_provider({method: 'eth_call', params:[{to: resolver, data: addr_SIG + namehash}, 'latest']}));
		if (!address) throw new TypeError('Invalid ABI Response from Resolver');
		address = checksum_address(address.slice(24));
	}
	return {resolver, address};
}

function decode_abi_string(s) {
	if (!/^0x[0]{62}20[0]{56}[a-f0-9]{8,}$/i.test(s)) throw new Error('Invalid ABI Response: expected string'); // abi string of len < 2**32
	const SKIP = 2 + 64 + 64; // 0x + [u256:type] + [u256:len]
	let hex_len = parseInt(s.slice(SKIP - 8, SKIP), 16) << 1; // read u32, double for hex
	if (SKIP + hex_len > s.length) throw new Error('Invalid ABI Response: incomplete');
	return decodeURIComponent(s.slice(SKIP, SKIP + hex_len).replace(/(.{2})/g, '%$1'));
}

// https://eips.ethereum.org/EIPS/eip-181
export async function ens_name_from_address(async_request_provider, address) {
	address = checksum_address(address);
	let namehash = ens_namehash(`${address.slice(2).toLowerCase()}.addr.reverse`);
	let resolver = validate_hex(64, await async_request_provider({method: 'eth_call', params:[{to: ENS_CONTRACT, data: resolver_SIG + namehash}, 'latest']}));
	if (!resolver) throw new TypeError('Invalid ABI Response from ENS Registry');	
	resolver = checksum_address(resolver.slice(24));
	let name = false;
	if (!/^0x[0]+$/.test(resolver)) {
		const name_SIG = '0x691f3431'; // name(bytes)
		name = decode_abi_string(await async_request_provider({method: 'eth_call', params:[{to: resolver, data: name_SIG + namehash}, 'latest']}));	
	}
	return {address, resolver, name};
}