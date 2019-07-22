#!/usr/bin/jq -f

def lang_tag(value):
  if value["xml:lang"]
  then "@" + value["xml:lang"]
  else ""
  end;

def datatype(value):
  if value.datatype
  then "^^<" + value.datatype + ">"
  else ""
  end;

def escape(value):
  value |
  gsub("\\\\"; "\\\\") |
  gsub("\t"; "\\t") |
  gsub("\b"; "\\b") |
  gsub("\n"; "\\n") |
  gsub("\r"; "\\r") |
  gsub("\f"; "\\f") |
  gsub("\""; "\\\"");

def literal(value):
  if value.type == "literal"
  then "\"" + escape(value.value) + "\"" + lang_tag(value) + datatype(value)
  elif value.type == "bnode"
  then "_:" + value.value
  else "<" + value.value + ">"
  end;

.results.bindings |
.[] |
(literal(.subject) + " " +
  literal(.predicate) + " " +
  literal(.object) + ".")
