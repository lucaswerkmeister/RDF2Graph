.PHONY: all clean
.PRECIOUS: %.ttl

all: $(patsubst %.sparql,%.shex,$(wildcard *.sparql))

%.ttl: %.sparql
	curl --location http://wikiba.se/ontology-beta | rdfparse | sed 's|http://wikiba.se/ontology|&-beta|g' > $@
	curl --get --header 'Accept: application/json' --data-urlencode "query=$$(cat $<)" https://query.wikidata.org/sparql | \
	jq --raw-output '.results.bindings | .[] | .item.value' | \
	xargs curl --silent --header 'Accept: text/turtle' --location -- >> $@

%-results: %.ttl
	fuseki-server --file $< /$* & \
	sleep 30s ; \
	java -jar RDF2Graph.jar $@ http://localhost:3030/$*/query --all ; \
	kill %1

%.shex: %-results
	shexExporter/export.sh $< $@

clean:
	$(RM) $(patsubst %.sparql,%.ttl,$(wildcard *.sparql))
	$(RM) -r $(patsubst %.sparql,%-results,$(wildcard *.sparql))
	$(RM) -r $(patsubst %.sparql,%.shex,$(wildcard *.sparql))
	$(RM) -r run/ temp/
