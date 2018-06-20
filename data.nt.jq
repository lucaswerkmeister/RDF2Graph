#!/usr/bin/jq -f

def lang_tag(value):
  if value["xml:lang"]
  then "@" + value["xml:lang"]
  else ""
  end;

def literal(value):
  if value.type == "literal"
  then "\"" + (value.value | gsub("\""; "\\\"")) + "\"" + lang_tag(value)
  else "<" + value.value + ">"
  end;

.results.bindings |
.[] |
(literal(.subject) + " " +
  literal(.predicate) + " " +
  literal(.object) + ".")
