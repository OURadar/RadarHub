# Modified from the example at
#
# https://stackoverflow.com/questions/58732872/can-python-load-definitions-from-a-c-header-file ,
#
# which is a modified version of:
#
# https://github.com/pyparsing/pyparsing/blob/master/examples/cpp_enum_parser.py ,
#
# to ignore the comments after "//"
#


from pathlib import Path
from enum import EnumMeta, IntEnum
from pyparsing import Group, LineEnd, Optional, Suppress, Word, ZeroOrMore
from pyparsing import alphas, alphanums, nums, restOfLine

CEnum = None

path = Path(__file__)

class CEnumType(EnumMeta):
    #
    @classmethod
    def __prepare__(metacls, clsname, bases, **kwds):
        # return a standard dictionary for the initial processing
        return {}
    #
    def __init__(clsname, *args , **kwds):
        super(CEnumType, clsname).__init__(*args)
    #
    def __new__(metacls, clsname, bases, clsdict, **kwds):
        if CEnum is None:
            # first time through, ignore the rest
            enum_dict = super(CEnumType, metacls).__prepare__(
                    clsname, bases, **kwds
                    )
            enum_dict.update(clsdict)
            return super(CEnumType, metacls).__new__(
                    metacls, clsname, bases, enum_dict, **kwds,
                    )
        members = []
        #
        # remove _file and _name using `pop()` as they will
        # cause problems in EnumMeta
        try:
            file = clsdict.pop('_file')
            # print(f'Using {file}')
        except KeyError:
            raise TypeError('_file not specified')
        c_enum_name = clsdict.pop('_name', clsname.lower())
        with open(file) as fh:
            file_contents = fh.read()

        #
        # syntax we don't want to see in the final parse tree
        LBRACE, RBRACE, EQ, COMMA = map(Suppress, "{}=,")
        _enum = Suppress("enum")
        identifier = Word(alphas, alphanums + "_")
        integer = Word(nums)
        comment = Suppress("//" + restOfLine + LineEnd())
        enumValue = Group(identifier("name") + Optional(EQ + integer("value")) + Optional(COMMA) + Optional(comment))
        enumList = Group(enumValue + ZeroOrMore(enumValue))
        enum = _enum + identifier("enum") + LBRACE + enumList("names") + RBRACE

        #
        # find the enum_name ignoring other syntax and other enums
        
        for item, _, _ in enum.scanString(file_contents):
            prefix = item[0]
            name = Optional(Suppress(prefix)) + identifier
            if item.enum != c_enum_name:
                continue
            id = 0
            for entry in item.names:
                if entry.value != "":
                    id = int(entry.value)
                key = name.parseString(entry.name)[0]
                members.append((key, id))
                id += 1
        #
        # get the real EnumDict
        enum_dict = super(CEnumType, metacls).__prepare__(clsname, bases, **kwds)
        # transfer the original dict content, names starting with '_' first
        items = list(clsdict.items())
        items.sort(key=lambda p: (0 if p[0][0] == '_' else 1, p))
        for name, value in items:
            enum_dict[name] = value
        # add the members
        for name, value in members:
            enum_dict[name] = value
        return super(CEnumType, metacls).__new__(
                metacls, clsname, bases, enum_dict, **kwds,
                )

class CEnum(IntEnum, metaclass=CEnumType):
    pass

class RadarHubType(CEnum):
    _file = f'{path.parent.absolute()}/types.h'
    _name = 'RadarHubType'

if __name__ == '__main__':
    print(list(RadarHubType))
