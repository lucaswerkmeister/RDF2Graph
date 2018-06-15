.PHONY: all clean
.PRECIOUS: %.ttl %.nt %-results %.shex %.html

all: $(patsubst %.sparql,%.html,$(wildcard *.sparql))

exclusion-patterns:
	curl --get --header 'Accept: application/json' --data-urlencode 'query=SELECT ?id WHERE { ?id wikibase:propertyType wikibase:ExternalId. }' https://query.wikidata.org/sparql | \
	jq --raw-output '.results.bindings | .[] | (.id.value[30:40] + ">")' > $@
	printf '<%s>\n' >> $@ 'http://www.w3.org/2000/01/rdf-schema#label' 'http://www.w3.org/2004/02/skos/core#prefLabel' 'http://schema.org/name' 'http://schema.org/description' 'http://www.w3.org/2004/02/skos/core#altLabel'

%.ttl: %.sparql
	curl --location http://wikiba.se/ontology-beta | rdfparse | sed 's|http://wikiba.se/ontology|&-beta|g' > $@
	curl --get --header 'Accept: application/json' --data-urlencode "query=$$(cat $<)" https://query.wikidata.org/sparql | \
	jq --raw-output '.results.bindings | .[] | .item.value' | \
	xargs curl --silent --header 'Accept: text/turtle' --location -- >> $@

%.nt: %.ttl exclusion-patterns
	ntriples $< | grep -vFf exclusion-patterns > $@

%-results: %.nt
	fuseki-server --file $< /$* & \
	bash -c 'while ! exec 3</dev/tcp/localhost/3030; do sleep 5s; done' 2>/dev/null ; \
	java -jar RDF2Graph.jar $@ http://localhost:3030/$*/query --all --executeSimplify --useClassPropertyRecoveryPerClass --remoteGraphFull https://query.wikidata.org/sparql ; \
	kill %1

%.shex: %-results
	shexExporter/export.sh $< $@

%.html: %.shex
	{ printf '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>%s</title>\n<script async src="https://lucaswerkmeister.de/annotate-wikidata-entity-ids-in-shex.js"></script>\n</head>\n<body>\n<pre id="shex">\n' $* && sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g;' $< && printf '</pre>\n</body>\n</html>\n'; } > $@

clean:
	$(RM) $(patsubst %.sparql,%.ttl,$(wildcard *.sparql))
	$(RM) -r $(patsubst %.sparql,%-results,$(wildcard *.sparql))
	$(RM) -r $(patsubst %.sparql,%.shex,$(wildcard *.sparql))
	$(RM) -r run/ temp/
