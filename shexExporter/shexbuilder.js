#!/usr/bin/env nodejs
'use strict';

var fs = require('fs');
var jsonld = require('./jsonld.js') 

const prefixes = {
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  schema: 'http://schema.org/',
  wikibase: 'http://wikiba.se/ontology-beta#',
  wd: 'http://www.wikidata.org/entity/',
  wdt: 'http://www.wikidata.org/prop/direct/',
  wdtn: 'http://www.wikidata.org/prop/direct-normalized/',
};

var multiplicityComment, typeComment;

function to_array(val)
{
  if(val === undefined)
    return [];
  var res = Array.isArray(val) ? val : [val];
  return res;
};

function encodeMultiplicity(val)
{
  multiplicityComment = null;
  if(val == "http://open-services.net/ns/core#Exactly-one")
    return "";
  else if(val == "http://open-services.net/ns/core#One-or-many")
    return "+";
  else if(val == "http://open-services.net/ns/core#Zero-or-many")
    return "*";
  else if(val == "http://open-services.net/ns/core#Zero-or-one")
    return "?";
  multiplicityComment = "No multiplicity defined defaulted to *";
  return "*";
}

const dataTypes = new Set();

function collectDataTypes(object)
{
  if(typeof object !== 'object')
    return;
  if(object['@type'] === 'DataType')
    dataTypes.add(object['@id']);
  Object.values(object).forEach(collectDataTypes);
}

function encodeType(val)
{
  typeComment = null;

  if(val === "http://ssb.wur.nl/RDF2Graph/invalid")
  {
    typeComment = "ref to invalid type";
    return ".";
  }

  if(val == "http://ssb.wur.nl/RDF2Graph/externalref")
  {
    return ".";
  }

  if(dataTypes.has(val))
    return formatIri(val);
  else
    return '@' + formatIri(val);
}

function formatComment()
{
  if(multiplicityComment != null)
  {
    if(typeComment != null)
      return "#" + multiplicityComment + " : " + typeComment;
    return "#" + multiplicityComment;
  }
  else if(typeComment != null)
    return "#" + typeComment;
  else
    return "";
}

function filterErrors(val)
{
  return val.filter(function(elem) { return !("error" in elem); });
}

function objectifyJSONLD(input,callback)
{ 
  jsonld.objectify(input['@graph'], input['@context'], {expandContext:input['@context']},
    function(err, result) {
      callback(err,result);
//    	 console.log(JSON.stringify(result, null, 2));
  });
}

function loadJSON_ld(file,callback) 
{
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      callback(err,null)
      return;
    }

    data = JSON.parse(data);
    jsonld.objectify(data['@graph'], data['@context'], {expandContext:data['@context']}, function(err, result) {
      if(err) 
      {
        callback(err,null)
      }
      else
      {
        callback(null,data['@graph']);
      } 
    });
  });
}

function formatIri(iri) {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace)) {
      return `${prefix}:${iri.substring(namespace.length)}`;
    }
  }

  return '<' + iri + '>';
}

function compareOn(...properties) {
  return (a, b) => {
    for (const property of properties) {
      a = a[property];
      b = b[property];
    }
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  };
}

function processResult(data)
{
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    process.stdout.write(`PREFIX ${prefix}: <${namespace}>\n`);
  }
  process.stdout.write('\n');

  collectDataTypes(data);

  const clazzes = data['class'];
  clazzes.sort(compareOn('@id'));
  for (const clazz of clazzes) {
    process.stdout.write(`${formatIri(clazz['@id'])} {`);
    if (clazz.subClassOf) {
      process.stdout.write(` # & ${to_array(clazz.subClassOf).map(formatIri).join()}`);
    }
    const props = to_array(clazz.property);
    props.sort(compareOn('rdfProperty', '@id'));
    let firstProp = true;
    for (const prop of props) {
      let typeLinks = to_array(prop.linkTo);
      typeLinks = filterErrors(typeLinks);
      typeLinks.sort(compareOn('type', '@id'));
      const typeLinksFormatted = [];
      for (const typeLink of typeLinks) {
        const iri = formatIri(prop.rdfProperty['@id']),
              type = encodeType(typeLink.type['@id']),
              multiplicity = encodeMultiplicity(typeLink.forwardMultiplicity['@id']),
              comment = formatComment();
        let typeLinkFormatted = `${iri} ${type}${multiplicity}`;
        if (comment) {
          typeLinkFormatted += ` ${comment}`;
        }
        typeLinksFormatted.push(typeLinkFormatted);
      }
      if (typeLinksFormatted.length) {
          if (firstProp) {
              process.stdout.write('\n');
              firstProp = false;
          } else {
              process.stdout.write(';\n');
          }
        if (typeLinksFormatted.length === 1) {
          process.stdout.write(`  ${typeLinksFormatted[0]}`);
        } else {
          process.stdout.write(`  (\n`);
          const lastTypeLinkFormatted = typeLinksFormatted.pop();
          for (const typeLinkFormatted of typeLinksFormatted) {
            process.stdout.write(`    ${typeLinkFormatted} |\n`);
          }
          process.stdout.write(`    ${lastTypeLinkFormatted}\n`);
          process.stdout.write(`  )`);
        }
      }
    }
    process.stdout.write('\n}\n\n');
  }
}

loadJSON_ld("temp/result.json",  function (err, data) {
  if (err) {
    console.log('Error: ' + err);
    return;
  }
  processResult(data[0] || { class: [] });

});

