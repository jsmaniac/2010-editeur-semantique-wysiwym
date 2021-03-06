$(function() {
	$(".éditeur-semantique").each(function(i,e) {
		éditeurSémantique(e, schémasTypesNoeud);
	});
});

function inRange(x, min, max) {
	if (typeof x != "number") {
		return 0;
	} else {
		return Math.min(Math.max(min,x), max);
	}
}

Object.keys = function(object) {
	var keys = [];
	for (var k in object) {
		keys.push(k);
	}
	return keys;
}

/* Renvoie un objet composé de trois fonctions :
 *
 * ajouterÉcouteur(déclenchementInitial)
 *     Enregistre un nouvel écouteur, et appelle
 *     déclenchementInitial si c'est une fonction.
 *     Cela permet d'initialiser l'écouteur la
 *     première fois qu'il s'enregistre.
 * enleverÉcouteur(écouteur)
 *     Permet enlève écouteur de la liste.
 * déclencherÉcouteurs(param1, ..., paramN)
 *     Appelle tous les écouteurs de la liste avec
 *     param1, ..., paramN comme paramètres.
 */
function Écoutable(déclenchementInitial) {
	var écouteurs = [];
	return {
		ajouterÉcouteur: function(écouteur) {
			if (écouteurs.indexOf(écouteur) < 0) {
				écouteurs.push(écouteur);
				if (déclenchementInitial)
					déclenchementInitial();
			}
		},
		enleverÉcouteur: function(écouteur) {
			var i = écouteurs.indexOf(écouteur);
			if (i >= 0) écouteurs.splice(i,1);
		},
		déclencherÉcouteurs: function() {
			var args = arguments;
			$(écouteurs).each(function(i,écouteur){
				écouteur.apply({}, args);
			});
		}
	};
}

function valeur(v) {
	var _valeur = v;
	var écoutable = new Écoutable(function() {
		// Première fois.
		écoutable.déclencherÉcouteurs(_valeur, _valeur);
	});
	var f = function(v) {
		return (typeof v == "undefined")
			? f.get()
			: f.set(v);
	};
	f.get = function() {
		return _valeur;
	}
	f.set = function(v) {
		if (v != _valeur) {
			_valeur = v;
			écoutable.déclencherÉcouteurs(v);
		}
	}
	f.ajouterÉcouteur = écoutable.ajouterÉcouteur;
	f.enleverÉcouteur = écoutable.enleverÉcouteur;
	return f;
}

/* ===== Types de noeud ===== */

var MULTI_LIGNE = 0;
var MONO_LIGNE = 1;
var EN_LIGNE = 2;

$.fn.extend({
	appendVuesEnfants: function (modèle, typeVue) {
		for (var i = 0; i < modèle.nbEnfants(); i++) {
			this.append(modèle.enfant(i).créerVue(typeVue));
		}
		var html = this;
		modèle.insérerEnfant.ajouterÉcouteur(function(noeud, position) {
			var v = noeud.créerVue(typeVue);
			if (position <= 0) {
				v.prependTo(html);
			} else if (position >= html.children().size()) {
				v.appendTo(html);
			} else {
				v.insertBefore(html.children().eq(position));
			}
		});
		modèle.supprimerEnfant.ajouterÉcouteur(function(position) {
			html.children().eq(position).remove();
		});
		return this;
	},
	bindText: function(valeur) {
		var that = this;
		valeur.ajouterÉcouteur(function(val) {
			that.text(val);
		});
		this.text(valeur.get());
		return this;
	},
	bindVal: function(valeur) {
		var that = this;
		valeur.ajouterÉcouteur(function(val) {
			if (that.val() != val)
				that.val(val);
		});
		this.val(valeur.get());
		this.bind("propertychange input cut paste keypress", function() {
			valeur.set(that.val());
		});
		return this;
	}
});

function squeletteAperçuNoeud(noeud) {
	var ct = {};
	ct[MULTI_LIGNE] = { tag: 'div',  tagc: 'div',  cat: 'multi-ligne' };
	ct[MONO_LIGNE]  = { tag: 'div',  tagc: 'span', cat: 'mono-ligne' };
	ct[EN_LIGNE]    = { tag: 'span', tagc: 'span', cat: 'en-ligne' };
	ct = ct[noeud.type().catégorie];
	
	var html = $('<' + ct.tag + ' class="noeud"/>').addClass(noeud.type().nom).addClass(ct.cat);
	var étiquette = $('<span class="étiquette"/>').appendTo(html);
	var contenu = $('<' + ct.tagc + ' class="contenu"/>').appendTo(html);
	
	html.click(function(){
		noeud.document().noeudActif.set(noeud);
		return false;
	});
	
	return html;
}

// Nettoie typesNoeud
function TypesNoeud(schémaDéfaut, schémasTypesNoeud) {
	for (var i in schémasTypesNoeud) {
		this[i] = $.extend({}, schémaDéfaut, schémasTypesNoeud[i]);
		this[i].vues = $.extend({}, schémaDéfaut.vues, schémasTypesNoeud[i].vues);
		this[i].nom = i;
	}
}

var schémasTypesNoeud = new TypesNoeud(
	{// Schéma par défaut
		catégorie: EN_LIGNE,
		enfants: ['texte'],
		vues: {
			aperçu: function() {
				return squeletteAperçuNoeud(this)
					.children(".contenu").appendVuesEnfants(this, 'aperçu').end();
			},
			édition: function() { // TODO : afficher la même chose que "édition.append(...);" (dans la vue de document).
				return $('<div class="info">Cliquez sur du texte pour le modifier.</div>');
			}
		},
		vue: function (typeVue) {
			var tv = this.type().vues[typeVue];
			return (tv) ? tv.call(this, typeVue) : $("<span/>");
		},
		propriétés: {}
	},
	{// Schémas des types de noeud
		document: {
			catégorie: MULTI_LIGNE,
			enfants: ['titre', 'paragraphe'],
			// surcharge de la _fonction_ "vue" (pas le tableau "vues").
			vue: function() {
				var html = $('<div class="conteneur-esem"/>');
				
				// Paneau Aperçu.
				var aperçu  = $('<div class="aperçu"/>').appendTo(html).appendVuesEnfants(this, 'aperçu');
				
				// Paneau Boutons
				var boutons = $('<div class="boutons"/>').appendTo(html);
				
				// Paneau Édition
				var édition = $('<div class="éditeur"/>').appendTo(html);
				this.noeudActif.ajouterÉcouteur(function(actif) {
					édition.empty();
					if (actif !== null) {
						édition.append(actif.créerVue("édition"));
					} else {
						édition.append('<div class="info">Cliquez sur du texte pour le modifier.</div>');
					}
				});
				
				return html;
			}
		},
		titre: {
			catégorie: MONO_LIGNE,
			enfants: ['important', 'texte'],
		},
		paragraphe: {
			catégorie: MULTI_LIGNE,
			enfants: ['important', 'texte'],
		},
		important: {
			catégorie: EN_LIGNE,
			enfants: ['texte'],
		},
		lien: {
			catégorie: EN_LIGNE,
			enfants: ['texte'],
			vues: {
				aperçu: function() {
					var ret = squeletteAperçuNoeud(this);
					$('<span class="cible"/>').bindText(this.propriété("cible")).appendTo(ret.children(".contenu"));
					$('<span class="texte"/>').bindText(this.propriété("texte")).appendTo(ret.children(".contenu"));
					return ret;
				},
				édition: function() {
					var html = $('<div/>');
					$('<label>Texte du lien : </label>').appendTo(html);
					$('<input type="text"/>').bindVal(this.propriété("texte")).appendTo(html);
					$('<br/>').appendTo(html);
					$('<label>Cible du lien : </label>').appendTo(html);
					$('<input type="text"/>').bindVal(this.propriété("cible")).appendTo(html);
					return html;
				},
			},
			propriétés: {
				interne: false,
				cible: 'http://www.example.com/',
				texte: 'texte du lien'
			}
		},
		texte: {
			catégorie: EN_LIGNE,
			enfants: [],
			vues: {
				aperçu: function() {
					var noeud = this;
					return $('<span class="noeud texte en-ligne"/>')
						.bindText(this.propriété("texte"))
						.click(function(){
							noeud.document().noeudActif.set(noeud);
							return false;
						});
				},
				édition: function() {
					return $('<textarea rows="10" cols="70"/>').bindVal(this.propriété("texte")); // TODO
				},
			},
			propriétés: {
				texte: ''
			}
		}
	}
);

/* ===== Manipulation des noeuds ===== */

var créerDocument = function(schémasTypesNoeud) {
	function clôture_référence_document(privé_document) {
		return {
			document: function() {
				return privé_document;
			}
		};
	};
	function clôture_parent() {
		var privé_parent = null;
		return {
			parent: function() {
				return privé_parent;
			},
			setParent: function(p) {
				// vérification de la cohérence du modèle
				if (p !== null && typeof p != "undefined" && p.indexOf(this) >= 0) {
					// Nouveau parent
					privé_parent = p;
				} else if (this.positionDansParent() >= 0) {
					// Parent existant
					// Pas de modification
				} else {
					// Pas de parent
					privé_parent = null;
				}
			},
			positionDansParent: function() {
				return (privé_parent === null) ? -1 : privé_parent.indexOf(this);
			}
		};
	};
	function clôture_enfants() {
		var privé_enfants = [];
		var écoutableInsérer = new Écoutable();
		var écoutableSupprimer = new Écoutable();
		var ret = {
			nbEnfants: function() {
				return privé_enfants.length;
			},
			enfant: function(i) {
				return privé_enfants[i];
			},
			indexOf: function(noeud) {
				return privé_enfants.indexOf(noeud);
			},
			insérerEnfant: function(noeud, position) {
				if (noeud.parent() !== null)
					noeud.supprimer();
				position = inRange(position, 0, privé_enfants.length);
				privé_enfants.splice(position, 0, noeud);
				// noeud.setParent() doit être appellé après l'insertion
				// car setParent vérifie qu'on est bien le parent.
				noeud.setParent(this);
				écoutableInsérer.déclencherÉcouteurs(noeud, position);
			},
			supprimerEnfant: function(position) {
				position = inRange(position, 0, privé_enfants.length - 1);
				var e = privé_enfants.splice(position, 1)[0];
				e.setParent(null);
				écoutableSupprimer.déclencherÉcouteurs(position);
				return e;
			}
		};
		ret.insérerEnfant.ajouterÉcouteur = écoutableInsérer.ajouterÉcouteur;
		ret.insérerEnfant.enleverÉcouteur = écoutableInsérer.enleverÉcouteur;
		ret.supprimerEnfant.ajouterÉcouteur = écoutableSupprimer.ajouterÉcouteur;
		ret.supprimerEnfant.enleverÉcouteur = écoutableInsérer.enleverÉcouteur;
		return ret;
	};
	function clôture_type(privé_type) {
		return {
			type: function() {
				return this.document().schémaTypeNoeud(privé_type);
			},
			setType: function(nouveauType) {
				// TODO : lien -> (texte ou important ou ...) doit préserver le texte du lien.
				// TODO : vérifier si le parent peut bien contenir ce type.
				// TODO : vérifier si ce type peut bien contenir les enfants actuels.
				privé_type = nouveauType;
				// TODO : modifier la vue
			}
		};
	};
	function clôture_propriétés(propriétésDéfaut) {
		var privé_propriétés = {};
		for (i in propriétésDéfaut) {
			privé_propriétés[i] = valeur(propriétésDéfaut);
		}
		
		return {
			propriété: function(nom) {
				return privé_propriétés[nom];
			},
			listePropriétés: function() {
				return Object.keys(privé_propriétés);
			}
		}
	};

	var supplément_manipulation = {
		supprimer: function() {
			return this.parent().supprimerEnfant(this.positionDansParent());
		},
		insérerAvant: function(noeud) { // insère noeud avant this (à l'extérieur).
			this.parent.insérerEnfant(noeud, this.positionDansParent());
		},
		insérerAprès: function(noeud) { // insère noeud après this (à l'extérieur).
			this.parent.insérerEnfant(noeud, this.positionDansParent() + 1);
		},
		insérerDébut: function(noeud) { // insère noeud au début de this (à l'intérieur).
			this.insérerEnfant(noeud, 0);
		},
		insérerFin: function(noeud) { // insère noeud à la fin de this (à l'intérieur).
			this.insérerEnfant(noeud, this.nbEnfants());
		},
		emballer: function(noeud) { // insère noeud à la place de this, et met this dedans.
			var pos = this.positionDansParent();
			var parent = this.parent();
			parent.supprimerEnfant(pos);
			parent.insérerEnfant(noeud, pos);
			noeud.insérerEnfant(this, 0);
		},
		remplacer: function () {
			var pos = this.positionDansParent();
			var parent = this.parent();
			parent.supprimerEnfant(pos);
			for (var i = 0; i < arguments.length; i++) {
				parent.insérerEnfant(arguments[i], pos++);
			}
		},
		déballer: function() { // Contraire de emballer : supprime this, mais garde le contenu.
			var c = [];
			for (var i = 0; i < this.nbEnfants(); i++) {
				c[i] = this.supprimerEnfant(i); // TODO : l'insertion devrait elle-même supprimer le noeud s'il est déjà inséré quelque part.
			}
			this.remplacer.apply(this, c);
		}
	};
	
	var supplément_vue = {
		créerVue: function(typeVue) {
			return this.type().vue.call(this, typeVue);
		}
	};
		
	var supplément_toString = {
		toString: function() {
			info = "[" + this.nbEnfants() + "]";
			var t = this.propriété("texte");
			if (t) info += ' "' + t.get() + '"';
			return this.type().nom + info;
		}
	};
	
	function clôture_document(privé_schémasTypesNoeud) {
		var privé_pressePapier = null;
		
		var privé_document = {
			noeudActif: valeur(null), // TODO : vérifier que ce soit bien null ou un noeud
			schémaTypeNoeud: function(type) {
				return privé_schémasTypesNoeud[type];
			},
			créerNoeud: function(type) {
				return $.extend(
					{},
					clôture_référence_document(privé_document),
					clôture_parent(),
					clôture_enfants(),
					clôture_type(type),
					clôture_propriétés(privé_schémasTypesNoeud[type].propriétés),
					supplément_manipulation,
					supplément_vue,
					supplément_toString
				);
			}
		};

		return $.extend(privé_document, privé_document.créerNoeud("document"));
	};
	
	return document = clôture_document(schémasTypesNoeud);
}

/* ===== Textarea => éditeur sémantique ===== */

function éditeurSémantique(textareaOrigine, schémasTypesNoeud) {
	// XML -> modèle
	var textareaOrigine = $(textareaOrigine);
	// TODO : Est-ce que le parsage de xml par jQuery est portable ? .
	// TODO : Utiliser .val() ? ou .text() ?
	var xml = $("<document/>").append(textareaOrigine.val());
	var modèle = XMLVersModèle(xml.get(0), schémasTypesNoeud);
	
	// Vue
	var vue = modèle.créerVue(null).insertAfter(textareaOrigine);
	// Il faut garder le textarea d'origine, sinon lors d'un refresh,
	// le textarea d'origine prend la valeur d'un des textarea affichés
	// et c'est cette mauvaise valeur qu'on récupère en tant que XML.
	textareaOrigine.hide();
	
	// Debug
	m = modèle;
	v = vue;
}

function XMLVersModèle(xml, schémasTypesNoeud, document) {
	var tag = xml.tagName.toLowerCase();
	
	// Création du noeud
	if (document) {
		var noeud = document.créerNoeud(tag);
	} else {
		var document = créerDocument(schémasTypesNoeud);
		var noeud = document;
	}
	
	// Remplissage des propriétés
	$.each(noeud.listePropriétés(), function(i,prop) {
		var propval = $(xml).attr(prop);
		if (typeof propval != "undefined") {
			noeud.propriété(prop).set(propval);
		}
	});
	
	// Remplissage des enfants
	$(xml).children().each(function (i,e) {
		var x = XMLVersModèle(e, schémasTypesNoeud, document);
		noeud.insérerFin(x);
	});
	
	return noeud;
}

/* Modèle :

{ document, noeudActif, pressePapiers }

// Todo : où indiquer TypeVue (aperçu, édition, boutons(?), arbre) ?

vue.supprimerVue();
vue.supprimerEnfant(position);
noeud.créerVue(typeVue);
vue.insérerEnfant(noeud_enfant, position) { insérer_dans_vue_courante_à_position(créerVue(noeud_enfant), position); }
vue.setPropriété(propriété, valeur);

*/







function éditeurSémantique_(textareaÉditeur) {
	var conteneur = $('<div class="conteneur-esem"/>');
	var éditeur = $(textareaÉditeur).removeClass("éditeur-semantique").addClass("éditeur");
	var boutons = $('<div class="boutons"/>');
	var aperçu = $('<div class="aperçu"/>');
	var elementActif = null;
	
	éditeur.replaceWith(conteneur);
	conteneur.append(aperçu);
	conteneur.append(boutons);
	conteneur.append(éditeur);
	
	var xml = $("<document/>").append(éditeur.text()); // Est-ce portable ?.
	éditeur.text("");
	
	function init() {
		xmlVersDom(xml, aperçu);
		sélectionElement(aperçu.children().first()); // assertion : type == Document
		bouton("important", function(debut, fin) {
			var t = elementActif.text();
			var t1 = créerElement("texte").text(t.substring(0,debut));
			var t2 = créerElement("texte").text(t.substring(debut,fin));
			var t2important = créerElement("important").append(t2);
			var t3 = créerElement("texte").text(t.substring(fin));
			elementActif.replaceWith(t1);
			t2important.insertAfter(t1);
			t3.insertAfter(t2important);
			sélectionElement(t2);
		});
	}
	
	function bouton(texte, fonction) {
		boutons.append($('<input type="button" class="bouton"/>').val(texte).click(function(e) {
			fonction(éditeur.get(0).selectionStart, éditeur.get(0).selectionEnd);
		}));
	}
	
	function xmlVersDom(xml,htmlParent) {
		var htmlElem = créerElement(xml.get(0).tagName.toLowerCase()).appendTo(htmlParent);
		
		if (xml.get(0).tagName.toLowerCase() == "texte") {
			htmlElem.append(xml.text());
		}
		
		xml.children().each(function(i,xmlElem) {
			xmlVersDom($(xmlElem),htmlElem);
		});
	}
	
	function créerElement(type) {
		var el = $('<span class="element"/>')
			.addClass(type)
			.data("type", type)
			.click(function(e) {
				sélectionElement(el);
				return false;
			});
		return el;
	}
	
	function sélectionElement(e) {
		elementActif = e;
		if (e.data("type") == "texte") {
			éditeurAttacher(e);
		} else {
			éditeurDétacher();
		}
	}
	
	function éditeurAttacher(elem) {
		éditeurDétacher();
		éditeur.val(elem.text());
		
		var éditeurValPrécédente = éditeur.val();
		function éditeurModif(e) {
			if (éditeur.val() != éditeurValPrécédente)
				elem.text(éditeur.val());
		}
		
		éditeur.bind("propertychange input cut paste keypress", éditeurModif);
	}
	
	function éditeurDétacher() {
		éditeur.unbind("propertychange input cut paste keypress");
		éditeur.val("");
	}
	
	init();
}