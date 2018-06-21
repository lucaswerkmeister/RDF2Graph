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

// IRIs that are used as datatypes
const dataTypes = new Set();
// non-datatype IRIs that are used as types
const usedTypes = new Set();
// non-datatype IRIs that occurred as types, but were dropped from the ShEx output (see dropProp)
const droppedTypes = new Set();

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

  if(dataTypes.has(val)) {
    return formatIri(val);
  } else {
    usedTypes.add(val);
    return '@' + formatIri(val);
  }
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

function filterExternalReferences(typeLinks)
{
  if (typeLinks.length <= 1)
    return typeLinks;
  return typeLinks.filter(function (typeLink) {
    return typeLink.type['@id'] !== 'http://ssb.wur.nl/RDF2Graph/externalref';
  });
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

// in some cases, the ShEx we produce for a certain predicate is unnecessary;
// since we do not produce CLOSED shapes, we can drop those predicates
function dropProp(typeLinks) {
  if (typeLinks.length > 10) {
    // so many different types are unlikely to result in a useful shape
    for (const typeLink of typeLinks) {
      droppedTypes.add(typeLink.type['@id']);
    }
    return true;
  }

  if (typeLinks.length === 1) {
    const typeLink = typeLinks[0];

    if (typeLink.forwardMultiplicity['@id'] === 'http://open-services.net/ns/core#Zero-or-many') {
      // the multiplicity ('*') carries no information

      if (typeLink.type['@id'] === 'http://ssb.wur.nl/RDF2Graph/externalref') {
        // the IRI is "any", so it carries no information either
        return true;
      }

      if (dataTypes.has(typeLink.type['@id'])) {
        // datatypes are enforced by Wikibase, no need to include it in the shape
        return true;
      }
    }
  }

  return false;
}

function classToShape(clazz) {
  let shape = '';

  shape += `${formatIri(clazz['@id'])} {`;
  if (clazz.subClassOf) {
    shape += ` # & ${to_array(clazz.subClassOf).map(formatIri).join()}`;
  }

  const props = to_array(clazz.property);
  props.sort(compareOn('rdfProperty', '@id'));
  let firstProp = true;

  for (const prop of props) {
    let typeLinks = to_array(prop.linkTo);
    typeLinks = filterErrors(typeLinks);
    typeLinks = filterExternalReferences(typeLinks);
    typeLinks.sort(compareOn('type', '@id'));
    if (dropProp(typeLinks)) {
      continue;
    }

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
        shape += '\n';
        firstProp = false;
      } else {
        shape += ';\n';
      }
      if (typeLinksFormatted.length === 1) {
        shape += `  ${typeLinksFormatted[0]}`;
      } else {
        shape += `  (\n`;
        const lastTypeLinkFormatted = typeLinksFormatted.pop();
        for (const typeLinkFormatted of typeLinksFormatted) {
          shape += `    ${typeLinkFormatted} |\n`;
        }
        shape += `    ${lastTypeLinkFormatted}\n`;
        shape += `  )`;
      }
    }
  }

  if (firstProp) {
    // empty shape, drop it if nothing else refers to it
    droppedTypes.add(clazz['@id']);
  }

  shape += '\n}';

  return shape;
}

function processResult(data)
{
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    process.stdout.write(`PREFIX ${prefix}: <${namespace}>\n`);
  }
  process.stdout.write('\n');

  collectDataTypes(data);

  const clazzes = data['class'];
  const shapes = new Map();
  for (const clazz of clazzes) {
    shapes.set(clazz['@id'], classToShape(clazz));
  }

  for (const droppedType of droppedTypes) {
    if (!usedTypes.has(droppedType)) {
      shapes.delete(droppedType);
    }
  }

  let firstShape = true;
  for (const shape of Array.from(shapes.entries()).sort(compareOn('0'))) {
    if (firstShape) {
      firstShape = false;
    } else {
      process.stdout.write('\n\n');
    }

    process.stdout.write(shape[1]);
  }
  process.stdout.write('\n');
}

loadJSON_ld("temp/result.json",  function (err, data) {
  if (err) {
    console.log('Error: ' + err);
    return;
  }
  processResult(data[0] || { class: [] });

});

