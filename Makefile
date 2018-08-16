.PHONY: all clean
.PRECIOUS: %.nt %-results %.shex %.html

SHELL := /bin/bash

all: $(patsubst %.entities.sparql,%.html,$(wildcard *.entities.sparql))

%.data.sparql: %.entities.sparql data.sparql.template
	sed $$'/%ENTITIES%/ {\n  r $<\n  d\n}' < data.sparql.template > $@

%.nt: %.data.sparql data.nt.jq
	curl --silent --show-error --get --header 'Accept: application/json' --data-urlencode "query=$$(<$<)" https://query.wikidata.org/sparql | jq --from-file ./data.nt.jq --raw-output > $@

%-results: %.nt
	fuseki-server --file $< /$* & \
	bash -c 'while ! exec 3</dev/tcp/localhost/3030; do sleep 5s; done' 2>/dev/null ; \
	java -jar RDF2Graph.jar $@ http://localhost:3030/$*/query --all --executeSimplify --useClassPropertyRecoveryPerClass --remoteGraphFull https://query.wikidata.org/sparql ; \
	kill %1

%.shex: %-results
	shexExporter/export.sh $< $@

%.html: %.shex
	{ printf '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>%s</title>\n<script async src="https://lucaswerkmeister.de/annotate-wikidata-entity-ids-in-shex.js"></script>\n<link rel="stylesheet" href="https://rawgit.com/richleland/pygments-css/master/default.css">\n</head>\n<body>\n<pre id="shex">\n' $* && pygmentize -f html $< && printf '</pre>\n</body>\n</html>\n'; } > $@

clean:
	$(RM) $(patsubst %.entities.sparql,%.data.sparql,$(wildcard *.entities.sparql))
	$(RM) $(patsubst %.entities.sparql,%.nt,$(wildcard *.entities.sparql))
	$(RM) -r $(patsubst %.entities.sparql,%-results,$(wildcard *.entities.sparql))
	$(RM) $(patsubst %.entities.sparql,%.shex,$(wildcard *.entities.sparql))
	$(RM) $(patsubst %.entities.sparql,%.html,$(wildcard *.entities.sparql))
	$(RM) -r run/ temp/
