.PHONY: all clean
.PRECIOUS: %.nt %-results %.shex %.html

SHELL := /bin/bash

all: $(patsubst %.entities.sparql,%.html,$(wildcard *.entities.sparql))

%.data.sparql: %.entities.sparql data.sparql.template
	sed $$'/%ENTITIES%/ {\n  r $<\n  d\n}' < data.sparql.template > $@

%.nt: %.data.sparql data.nt.jq
	curl --silent --show-error --get --header 'Accept: application/json' --data-urlencode "query=$$(<$<)" https://query.wikidata.org/sparql | jq --from-file ./data.nt.jq --raw-output > $@

%-results: %.nt
	set -m ; \
	FUSEKI_BASE=$*-fuseki fuseki-server --file $< --port 0 /$* & \
	while ! [[ -v FUSEKI_PORT ]]; do while read -r line; do if [[ $$line == n* ]]; then FUSEKI_PORT=$${line##*:}; break 2; fi; done < <(jobs -x lsof -p %1 -a -i -Fn -n -P); sleep 5s; done ; \
	java -jar RDF2Graph.jar $@ http://localhost:$$FUSEKI_PORT/$*/query --all --executeSimplify --useClassPropertyRecoveryPerClass --remoteGraphFull https://query.wikidata.org/sparql ; \
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
	$(RM) -r $(patsubst %.entities.sparql,%-fuseki,$(wildcard *.entities.sparql))
	$(RM) -r temp/
