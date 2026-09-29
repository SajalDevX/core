const repl_parser_map = {};

function repl_parse(cmd) {
	const command_str = cmd.toString();
	let current_position = command_str.indexOf(' ');

	if (current_position === -1) {
		current_position = command_str.length;
	}

	const key = command_str.substring(0, current_position);

	if (key === '') {
		return [];
	}

	const command = repl_parser_map[key];

	if (!command) {
		throw new Error(`Command '${key}' not valid, use 'help' for more information`);
	}

	const tokens = [];

	const skip_whitespaces = (str, position) => {
		while (str[position] === ' ') {
			++position;
		}

		return position;
	}

	/* Tokens are separated by whitespaces, so a match must end at a whitespace or at the end of the command */
	const is_token_boundary = (str, position) => {
		return position >= str.length || str[position] === ' ';
	}

	for (let param_count = 0; param_count < command.regexes.length; ++param_count) {
		current_position = skip_whitespaces(command_str, current_position);
		const param = command_str.substring(current_position);
		const current_type = command.types[param_count];
		const current_regex = command.regexes[param_count];

		switch (current_type) {
			case 'METACALL_STRING': {
				if (!current_regex.test(param)) {
					throw new Error(`Failed to parse the command: '${param}' of type ${current_type}, the expected regex was: ${current_regex.toString()}`)
				}
				const next_position = current_regex.lastIndex;
				if (!is_token_boundary(param, next_position)) {
					/* Reset last index because the regex is shared between calls */
					current_regex.lastIndex = 0;
					throw new Error(`Failed to parse the command: '${param}' of type ${current_type}, the token '${param.substring(0, next_position)}' matched by the regex ${current_regex.toString()} must be followed by a whitespace or the end of the command`)
				}
				tokens.push(param.substring(0, next_position));
				current_position += next_position;
				break;
			}
			case 'METACALL_ARRAY': {
				const values = []

				/* Array will iterate meanwhile the regex matches or there is characters left */
				while (current_position < command_str.length) {
					const subparam = command_str.substring(current_position);
					if (!current_regex.test(subparam)) {
						break;
					}

					/* Obtain the next position and push the current value, then skip whitespaces */
					const next_position = current_regex.lastIndex;
					if (!is_token_boundary(subparam, next_position)) {
						/* The regex matched only a prefix of the token, leave it for the next parameter */
						break;
					}
					values.push(subparam.substring(0, next_position));
					current_position = skip_whitespaces(command_str, current_position + next_position);

					/* Reset last index in order to test the next value */
					current_regex.lastIndex = 0;
				}
				tokens.push(values);
				break;
			}

			default: {
				throw new Error(`Failed to parse command '${command_str}', type ${current_type} is not implemented`);
			}
		}

		/* Reset the regex for the next command */
		current_regex.lastIndex = 0;
	}

	return [key, ...tokens]
}

function repl_register(cmd, regexes, types) {
	if (regexes.length !== types.length) {
		throw new Error('Number of Regexes and Types do not match')
	}
	repl_parser_map[cmd] = {
		regexes: regexes.map(re => new RegExp(re, 'g')),
		types
	}
}

function repl_register_map(map) {
	Object.keys(map).forEach(key => repl_register(key, map[key].regexes, map[key].types));
};

function repl_register_from_file(file) {
	const map = require(file);
	repl_register_map(map);
}

module.exports = {
	repl_register,
	repl_register_map,
	repl_register_from_file,
	repl_completer: () => Object.keys(repl_parser_map),
	repl_parse,
};
