// recursive decent parser using regex
// ES6 syntax, requires sticky regex compatibility (chrome & node)

let factorial = (() => {
    let factorialCache = []; // for memoization
    return a => (a |= 0) < 1 ? 1 : factorialCache.length > a ? factorialCache[a] : (factorialCache[a] = a * factorial(a - 1));
})();

class Lvalue {
    constructor(value) {
        value = value.hasOwnProperty('value') ? value.value : value;
        Object.defineProperties(this, {
            value: {
                get: function () {
                    return value;
                },
                set: function (newvalue) {
                    throw new Error('Cannot assign to an lvalue');
                },
                enumerable: true
            },
            lvalue: {
                value: true,
                enumerable: true,
                writable: false
            }
        });
    }
}

class Expression {
    constructor(expression) {
        this.text = expression;
        this.pos = 0;
        this.skipWhitespace();
    }

    skipWhitespace () {
        this.regWhitespace.lastIndex = this.pos;
        
        if (this.regWhitespace.exec(this.text)) {
            this.pos = this.regWhitespace.lastIndex;
        }
    }
    
    accept (regex) {
        regex.lastIndex = this.pos;
        let ret = regex.exec(this.text);
        
        if(ret) {
            this.pos = regex.lastIndex;
            this.skipWhitespace();
            return ret[0];
        }
        
        return null;
    }
    
    remaining () {
        if (this.pos < this.text.length) {
            return this.text.slice(this.pos);
        }
        
        return "";
    }
}

Expression.prototype.regWhitespace = /\s+/y;

class Parser {
    constructor () {
        this.variables = {
            'true': new Lvalue(true),
            'false': new Lvalue(false),
            'Infinity': new Lvalue(Infinity),
            'infinity': new Lvalue(Infinity),
            'PI': new Lvalue(Math.PI),
            'pi': new Lvalue(Math.PI),
        };
    }
    
    number (EX) {
        let ret = EX.accept(this.regNumber);
        
        if(ret) {
            ret = parseFloat(ret);
            
            return new Lvalue(ret);
        } else {
            return null;
        }
    }
    
    identifier (EX) {
        let ret = EX.accept(this.regIdent);
        
        if(ret) {
            if(!this.variables.hasOwnProperty(ret)) {
                this.variables[ret] = { value: 0, lvalue: false };
            }
            
            return this.variables[ret];
        } else {
            return null;
        }
    }
    
    value (EX) {
        let ret = this.number(EX) || this.identifier(EX);
        
        if(ret === null) {
            throw new Error('Expected number or identifier @ ' + EX.pos);
        }
        
        if(!ret.lvalue) {
            let post = EX.accept(this.regPostfix);
            
            if(post) {
                return this.operations[post].exec(ret);
            }
        }

        return ret;
    }
    
    parenthesis (EX) {
        if (EX.accept(this.regOpenParenthesis)) {
            let ret = this.expression(EX);
            
            if(!EX.accept(this.regClosingParenthesis)) {
                throw new Error('Expected closing parenthesis @ ' + EX.pos);
            }
            
            return ret;
        } else {
            return this.value(EX);
        }
    }
    
    prefix (EX) {
        let ret = EX.accept(this.regPrefix);

        if(ret) {
            return this.prefixOps[ret](this.prefix(EX));
        } else {
            return this.parenthesis(EX);
        }
    }
    
    term (EX) {
        return this.prefix(EX);
    }
    
    operator (EX, lvl = 0) {
        if(lvl >= Parser.prototype.rules.length) {
            return this.term(EX);
        }
        
        let ret, value = this.operator(EX, lvl + 1);
        while((ret = EX.accept(Parser.prototype.rules[lvl]))) {
            switch(this.operations[ret].exec.length) {
            case 0:
                value = this.operations[ret].exec();
                break;
            case 1:
                value = this.operations[ret].exec(value);
                break;
            case 2:
                value = this.operations[ret].exec(value, this.operator(EX, this.operations[ret].right ? lvl : lvl + 1));
                break;
            default:
                throw new Error('Operator ' + ret + ' requires too many arguments. No idea what to do with it...');
            }
        }
        
        return value;
    }
    
    expression (EX) {
        return this.operator(EX);
    }
    
    evaluate (text) {
        let EX = new Expression(text), ret = this.expression(EX);
        
        while(EX.remaining()) {
            if(EX.accept(this.regEOS)) {
                if (EX.remaining()) {
                    ret = this.expression(EX);
                }
            } else {
                throw new Error("Unexpected character @ " + EX.pos);
            }
            
        }
        
        return ret.value;
    }
}

Parser.prototype.regIdent = /[a-zA-Z_][a-zA-Z_\d]*/y;
Parser.prototype.regNumber = /\d+(\.\d+)?([eE]\d+)?/y;
Parser.prototype.regPrefix = /\+\+|--|\+|-|!|~/y;
Parser.prototype.regPostfix = /(\+\+)|(--)/y;
Parser.prototype.regOpenParenthesis = /\(/y;
Parser.prototype.regClosingParenthesis = /\)/y;
Parser.prototype.regEOS = /\s*;[;\s]*/y;

Parser.prototype.operations = {
    '++': {exec: a => new Lvalue(a.value++)},
    '--': {exec: a => new Lvalue(a.value--)},
    ',': {exec: (a, b) => b, right: false},
    '+': {exec: (a, b) => new Lvalue(a.value + b.value), right: false},
    '-': {exec: (a, b) => new Lvalue(a.value - b.value), right: false},
    '*': {exec: (a, b) => new Lvalue(a.value * b.value), right: false},
    '/': {exec: (a, b) => new Lvalue(a.value / b.value), right: false},
    '%': {exec: (a, b) => new Lvalue(a.value % b.value), right: false},
    '**': {exec: (a, b) => new Lvalue(Math.pow(a.value, b.value)), right: true},
    '!': {exec: a => new Lvalue(factorial(a.value))},
    '=': {exec: (a, b) => (a.value = b.value, a), right: true},
    '**=': {exec: (a, b) => (a.value = Math.pow(a.value, b.value), a), right: true},
    '*=': {exec: (a, b) => (a.value *= b.value, a), right: true},
    '+=': {exec: (a, b) => (a.value += b.value, a), right: true},
    '-=': {exec: (a, b) => (a.value -= b.value, a), right: true},
    '/=': {exec: (a, b) => (a.value /= b.value, a), right: true},
    '%=': {exec: (a, b) => (a.value %= b.value, a), right: true},
    '>>>=': {exec: (a, b) => (a.value >>>= b.value, a), right: true},
    '>>=': {exec: (a, b) => (a.value >>= b.value, a), right: true},
    '<<=': {exec: (a, b) => (a.value <<= b.value, a), right: true},
    '&=': {exec: (a, b) => (a.value &= b.value, a), right: true},
    '^=': {exec: (a, b) => (a.value ^= b.value, a), right: true},
    '|=': {exec: (a, b) => (a.value |= b.value, a), right: true},
    '==': {exec: (a, b) => new Lvalue(a.value == b.value), right: false},
    '===': {exec: (a, b) => new Lvalue(a.value === b.value), right: false},
    '!=': {exec: (a, b) => new Lvalue(a.value != b.value), right: false},
    '!==': {exec: (a, b) => new Lvalue(a.value !== b.value), right: false},
    '<=': {exec: (a, b) => new Lvalue(a.value <= b.value), right: false},
    '<': {exec: (a, b) => new Lvalue(a.value < b.value), right: false},
    '>=': {exec: (a, b) => new Lvalue(a.value >= b.value), right: false},
    '>': {exec: (a, b) => new Lvalue(a.value > b.value), right: false},
    '||': {exec: (a, b) => new Lvalue(a.value || b.value), right: false},
    '&&': {exec: (a, b) => new Lvalue(a.value && b.value), right: false},
    '|': {exec: (a, b) => new Lvalue(a.value | b.value), right: false},
    '^': {exec: (a, b) => new Lvalue(a.value ^ b.value), right: false},
    '&': {exec: (a, b) => new Lvalue(a.value & b.value), right: false},
    '>>>': {exec: (a, b) => new Lvalue(a.value >>> b.value), right: false},
    '>>': {exec: (a, b) => new Lvalue(a.value >> b.value), right: false},
    '<<': {exec: (a, b) => new Lvalue(a.value << b.value), right: false},
};

Parser.prototype.prefixOps = {
    '++': a => new Lvalue(++a.value),
    '--': a => new Lvalue(--a.value),
    '+': a => new Lvalue(a.value),
    '-': a => new Lvalue(-a.value),
    '~': a => new Lvalue(~a.value),
    '!': a => new Lvalue(!a.value),
};

Parser.prototype.rules = [];
Parser.prototype.rules.push(/,/y);
Parser.prototype.rules.push(/=|\+=|-=|\*\*=|\*=|\/=|%=|<<=|>>>=|>>=|&=|\^=|\|=/y);
Parser.prototype.rules.push(/\|\|/y);
Parser.prototype.rules.push(/&&/y);
Parser.prototype.rules.push(/\|(?!\||=)/y);
Parser.prototype.rules.push(/\^(?!=)/y);
Parser.prototype.rules.push(/&(?!&|=)/y);
Parser.prototype.rules.push(/===|==|!==|!=/y);
Parser.prototype.rules.push(/(>>>|>>|<<)(?!=)/y);
Parser.prototype.rules.push(/<=?(?!<)|>=?(?!>)/y);
Parser.prototype.rules.push(/(\+(?!\+)|-(?!-))(?!=)/y);
Parser.prototype.rules.push(/(\*(?!\*)|\/|%)(?!=)/y);
Parser.prototype.rules.push(/\*\*(?!=)/y);
Parser.prototype.rules.push(/!(?!=)/y);

try {
    module.exports = Parser;
} catch (err) {
    // fail silently
}
