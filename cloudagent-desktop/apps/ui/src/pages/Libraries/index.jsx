import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../components/ui/button';
import {
  ArrowRight,
  Blocks,
  Bolt,
  BookCheck,
  PlayCircle,
  Search,
  Package,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import PackageCard from '../../components/PackageCard';
import { Input } from '../../components/ui/input';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Icons } from '../../components/icons';
import HelpChatModal from '../../components/HelpChatModal';
import { useSEO } from '../../hooks/useSEO';
import { fetchBlueprints } from '../../features/blueprint/blueprintSlice';
import { fetchAgentList } from '@/helpers/agentList';

// Static featured items for each category
const FEATURED_ITEMS_BY_CATEGORY = {
  'Identity & Access Management': [
    {
      id: 'root_account_security',
      title: 'Root Account Security',
      description:
        'Ensure your root account is secured by checking MFA, last-used credentials, access keys.',
      type: 'agent',
      class: 'build',
      credits: 4,
      active: true,
    },
    {
      id: 'iam_mfa_workflow',
      title: 'IAM MFA Setup Workflow',
      description: 'Automated workflow to enable MFA for all IAM users.',
      type: 'workflow',
      credits: 25,
      active: true,
    },
  ],
  'Cost & Billing': [
    {
      id: 'unused_resources_summary',
      title: 'Unused Resources with Email Summary',
      description:
        'Run unused resources report and send a custom summary email to the team.',
      type: 'workflow',
      credits: 20,
      active: true,
    },
  ],
  'Security & Compliance': [
    {
      id: 'startup-baseline',
      title: 'Startup Security Baseline',
      description:
        'Essential security controls and configurations tailored for startup environments.',
      type: 'package',
      includedAgents: 10,
      credits: 80,
      active: true,
    },
  ],
};

const STATIC_CATEGORIES = [
  { label: 'All Reports', key: 'all-reports' },
  { label: 'All Workflows', key: 'all-workflows' },
  { label: 'All Packages', key: 'all-packages' },
];
const MY_BLUEPRINTS_CATEGORY = { label: 'My Blueprints', key: 'my-blueprints' };

const AllLibraries = () => {
  const [allItems, setAllItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchBarValue, setSearchBarValue] = useState('');
  const [typeFilters, setTypeFilters] = useState({
    workflow: true,
    package: true,
    report: true,
  });
  const [classFilters, setClassFilters] = useState({});
  const [availableClasses, setAvailableClasses] = useState([]);
  const [cloudProviderFilters, setCloudProviderFilters] = useState({
    aws: true,
    gcp: true,
    azure: true,
    google_workspace: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpChatOpen, setIsHelpChatOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { categoryName } = useParams();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const { userBlueprints } = useSelector((state) => state.blueprint);

  const parseBlueprintDescription = (description) => {
    if (Array.isArray(description)) {
      return description.filter(Boolean).join(' ');
    }
    if (typeof description === 'string') {
      try {
        const parsed = JSON.parse(description);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).join(' ');
        }
        return description;
      } catch {
        return description;
      }
    }
    return 'Custom blueprint';
  };

  const getBlueprintCloudProvider = (blueprint) => {
    try {
      const planData =
        typeof blueprint?.plan === 'string'
          ? JSON.parse(blueprint.plan)
          : blueprint?.plan;
      return (
        planData?.cloudProvider ||
        planData?.plan?.[0]?.tasks?.[0]?.cloudProvider ||
        'aws'
      );
    } catch {
      return 'aws';
    }
  };

  const userBlueprintItems = (userBlueprints || []).map((blueprint, index) => ({
    id: blueprint.recordId,
    uniqueId: `my-blueprint-${blueprint.recordId || index}`,
    title: blueprint.title || 'Untitled Blueprint',
    description: parseBlueprintDescription(blueprint.description),
    type: 'agent',
    class: 'build',
    credits: blueprint.credits || 0,
    active: (blueprint?.status || '').toLowerCase() === 'ready',
    cloudProvider: getBlueprintCloudProvider(blueprint),
    category: MY_BLUEPRINTS_CATEGORY.label,
    recordId: blueprint.recordId,
    isUserBlueprint: true,
  }));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetchAgentList();
        const data = await response.json();

        const combinedItems = [...data].map((item, index) => ({
          ...item,
          uniqueId: `${item.type}-${item.id}-${index}`,
        }));

        const uniqueItems = combinedItems.filter(
          (item, index, self) =>
            index ===
            self.findIndex((i) => i.id === item.id && i.type === item.type)
        );

        setAllItems(uniqueItems);

        const uniqueCategories = [
          ...new Set(uniqueItems.map((item) => item.category)),
        ]
          .filter(Boolean)
          .sort();

        setCategories(uniqueCategories);

        const classes = [
          ...new Set(uniqueItems.map((item) => item.class).filter(Boolean)),
        ];
        setAvailableClasses(classes);

        const initialClassFilters = classes.reduce((acc, classType) => {
          acc[classType] = true;
          return acc;
        }, {});
        setClassFilters(initialClassFilters);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchBlueprints({ count: 50 }));
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (categories.length > 0) {
      if (categoryName) {
        const staticMeta = STATIC_CATEGORIES.find(
          (meta) => meta.key === categoryName
        );
        if (staticMeta) {
          setActiveCategory(staticMeta.label);
          return;
        }

        if (categoryName === MY_BLUEPRINTS_CATEGORY.key) {
          setActiveCategory(MY_BLUEPRINTS_CATEGORY.label);
          return;
        }

        const decodedCategory = decodeURIComponent(
          categoryName.replace(/_/g, ' ').replace(/and/g, '&')
        );

        const matchedCategory = categories.find(
          (cat) => getCategoryUrl(cat) === categoryName.toLowerCase()
        );

        setActiveCategory(matchedCategory || decodedCategory);
      } else {
        setActiveCategory(categories[0] || '');
      }
    }
  }, [categoryName, categories]);

  const getCategoryUrl = (category) => {
    return category.toLowerCase().replace(/\s+/g, '_').replace(/[&]/g, 'and');
  };

  const getCategoryCount = (category) => {
    return allItems.filter((item) => item.category === category).length;
  };

  const isSecurityLibraryCategory = (category = '') => {
    const normalized = String(category || '').toLowerCase();
    return (
      normalized.includes('security') &&
      (normalized.includes('compliance') || normalized.includes('governance'))
    );
  };

  const securityReportCount = allItems.filter(
    (item) =>
      item.type === 'report' && isSecurityLibraryCategory(item.category)
  ).length;

  const securityFrameworkCount = allItems.filter(
    (item) =>
      item.type === 'report' &&
      isSecurityLibraryCategory(item.category) &&
      /compliance|benchmark|framework|soc2|hipaa|gdpr|pci|nist|fedramp|cmmc|iso|cis/i.test(
        item.title || ''
      )
  ).length;

  // Get items for current category (before applying type/class/provider filters)
  const categoryItems = [...allItems, ...userBlueprintItems].filter((item) => {
    if (activeCategory === 'All Reports') return item.type === 'report';
    if (activeCategory === 'All Agents') return item.type === 'agent';
    if (activeCategory === 'All Workflows') return item.type === 'workflow';
    if (activeCategory === 'All Packages') return item.type === 'package';
    if (activeCategory === MY_BLUEPRINTS_CATEGORY.label)
      return item.category === MY_BLUEPRINTS_CATEGORY.label;
    return item.category === activeCategory;
  });

  // Compute available filter options based on items in current category
  const availableFiltersInCategory = {
    types: [...new Set(categoryItems.map((item) => item.type).filter(Boolean))],
    classes: [...new Set(categoryItems.map((item) => item.class).filter(Boolean))],
    cloudProviders: [...new Set(categoryItems.map((item) => item.cloudProvider || 'aws').filter(Boolean))],
  };

  const filteredItems = categoryItems.filter((item) => {
    // Apply search filter
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchBarValue.toLowerCase());
    
    // Apply type filter
    const matchesTypeFilter = typeFilters[item.type] ?? true;
    
    // Apply class filter
    const matchesClassFilter = !item.class || classFilters[item.class];
    
    // Apply cloud provider filter
    const itemProvider = item.cloudProvider || 'aws';
    const matchesProviderFilter = cloudProviderFilters[itemProvider] ?? true;

    return (
      matchesSearch &&
      matchesTypeFilter &&
      matchesClassFilter &&
      matchesProviderFilter
    );
  });

  const handleItemClick = (item) => {
    if (item.isUserBlueprint && item.recordId) {
      navigate(`/blueprint/${item.recordId}`);
      return;
    }

    switch (item.type) {
      case 'agent':
        navigate(`/library/blueprint/${item.id}`);
        break;
      case 'report':
        navigate(`/library/report/${item.id}`, {
          state: {
            type: 'assessment',
          },
        });
        break;
      case 'workflow':
        navigate(`/library/workflow-template/${item.id}`);
        break;
      case 'package':
        navigate(`/package/${item.id}`);
        break;
      default:
        console.warn('Unknown item type:', item.type);
    }
  };

  const handleCategoryClick = (category) => {
    const categoryUrl = getCategoryUrl(category);
    setActiveCategory(category);
    navigate(`/libraries/${categoryUrl}`);
  };

  const getFeaturedItems = (category) => {
    // return FEATURED_ITEMS_BY_CATEGORY[category] || []; // temporarily disabled
    return [];
  };

  const getStaticCategoryCount = (label) => {
    switch (label) {
      case 'All Reports':
        return allItems.filter((item) => item.type === 'report').length;
      case 'All Agents':
        return allItems.filter((item) => item.type === 'agent').length;
      case 'All Workflows':
        return allItems.filter((item) => item.type === 'workflow').length;
      case 'All Packages':
        return allItems.filter((item) => item.type === 'package').length;
      case 'My Blueprints':
        return userBlueprintItems.length;
      default:
        return 0;
    }
  };

  // Generate SEO title and description based on active category
  const getSEOMetadata = () => {
    if (!activeCategory) {
      return {
        title: 'Cloud Agent Library',
        description: 'Browse our comprehensive library of cloud automation agents, workflows, reports, and packages. Find pre-built solutions for security compliance, cost optimization, infrastructure management, and more.',
      };
    }

    // Static category SEO metadata
    const staticCategorySEO = {
      'All Reports': {
        title: 'Cloud Security & Compliance Reports',
        description: 'Browse comprehensive cloud security and compliance assessment reports. Analyze your infrastructure security posture, identify compliance gaps, and get actionable recommendations for AWS, Azure, and GCP.',
      },
      'All Workflows': {
        title: 'Cloud Automation Workflows',
        description: 'Discover automated cloud workflows for infrastructure management, security compliance, cost optimization, and operational tasks. Pre-built workflows ready to deploy and customize.',
      },
      'All Packages': {
        title: 'Cloud Agent Packages',
        description: 'Explore curated packages of cloud automation agents and workflows. Bundled solutions for startup security baselines, compliance frameworks, cost optimization, and more.',
      },
      'All Agents': {
        title: 'Cloud Automation Agents',
        description: 'Browse our library of AI-powered cloud automation agents. Pre-built agents for security compliance, cost optimization, infrastructure management, and cloud operations.',
      },
      'My Blueprints': {
        title: 'My Blueprints - Cloud Agent Library',
        description: 'View and run your custom blueprints created in the dashboard. Access your personalized automation blueprints directly from the library.',
      },
    };

    if (staticCategorySEO[activeCategory]) {
      return staticCategorySEO[activeCategory];
    }

    // Dynamic category SEO metadata
    const categoryCount = getCategoryCount(activeCategory);
    const categoryItems = allItems.filter((item) => item.category === activeCategory);
    const itemTypes = [...new Set(categoryItems.map((item) => item.type))];
    const typeLabels = itemTypes.map((type) => {
      switch (type) {
        case 'report': return 'reports';
        case 'workflow': return 'workflows';
        case 'package': return 'packages';
        case 'agent': return 'agents';
        default: return type + 's';
      }
    }).join(' and ');

    return {
      title: `${activeCategory} - Cloud Agent Library`,
      description: `Browse ${categoryCount} ${typeLabels} in ${activeCategory}. Find pre-built cloud automation solutions, security compliance tools, and infrastructure management resources for your cloud environment.`,
    };
  };

  // Apply SEO metadata
  const seoMetadata = getSEOMetadata();
  useSEO({
    title: seoMetadata.title,
    description: seoMetadata.description,
    enabled: !isLoading,
  });

  const showSecurityCategoryCallouts =
    isSecurityLibraryCategory(activeCategory);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="w-64 bg-white border-r border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-12 bg-gray-200 rounded mb-6"></div>
            <div className="flex flex-wrap gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-gray-200 rounded flex-1 min-w-80"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mx-auto p-2 sm:p-4 h-[100%] md:h-screen">
      {/* <div className="bg-primary-50 rounded-2xl px-4 sm:px-6 py-4 my-2 sm:my-4 mx-2 sm:mx-6">
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Icons.aiIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2" />
              <span className="text-primary-800 text-base sm:text-lg font-bold">
                How can we help you today?
              </span>
            </div>
            <span className="text-primary-600 text-xs sm:text-sm">
              Coming soon!
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
          <Input
            disabled
            placeholder="I need to run a agent..."
            type="text"
            className="border-primary-200 "
            wrapperClassName="flex-1"
          />
          <Button
            onClick={() => setIsHelpChatOpen(true)}
            className="min-w-[200px]"
            // disabled
          >
            Start Chat
          </Button>
        </div>
      </div> */}

      <div className="p-4 sm:p-6">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
          All Libraries
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row h-[100%] md:h-[calc(100vh-220px)] bg-gray-50">
        <div className="lg:w-[320px] lg:flex-shrink-0 bg-white border-b lg:border-r lg:border-b-0 border-gray-200 flex flex-col overflow-hidden">
          <div className="lg:hidden">
            <div className="px-4 py-3">
              <h2 className="text-sm font-medium text-gray-900 mb-3">
                Categories
              </h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {STATIC_CATEGORIES.map((meta) => (
                  <Button
                    key={meta.key}
                    variant={
                      activeCategory === meta.label ? 'default' : 'ghost'
                    }
                    size="sm"
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      activeCategory === meta.label
                        ? 'bg-primary-50 text-primary-700 font-bold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setActiveCategory(meta.label);
                      navigate(`/libraries/${meta.key}`);
                    }}
                  >
                    <span>{meta.label}</span>
                    {['All Reports', 'All Workflows', 'All Packages'].includes(
                      meta.label
                    ) && (
                      <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {getStaticCategoryCount(meta.label)}
                      </span>
                    )}
                  </Button>
                ))}

                <Button
                  key={MY_BLUEPRINTS_CATEGORY.key}
                  variant={
                    activeCategory === MY_BLUEPRINTS_CATEGORY.label
                      ? 'default'
                      : 'ghost'
                  }
                  size="sm"
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    activeCategory === MY_BLUEPRINTS_CATEGORY.label
                      ? 'bg-primary-50 text-primary-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setActiveCategory(MY_BLUEPRINTS_CATEGORY.label);
                    navigate(`/libraries/${MY_BLUEPRINTS_CATEGORY.key}`);
                  }}
                >
                  <span>{MY_BLUEPRINTS_CATEGORY.label}</span>
                  <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {getStaticCategoryCount(MY_BLUEPRINTS_CATEGORY.label)}
                  </span>
                </Button>

                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={activeCategory === category ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      activeCategory === category
                        ? 'bg-primary-50 text-primary-700 font-bold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    onClick={() => handleCategoryClick(category)}
                  >
                    <span>{category}</span>
                    <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {getCategoryCount(category)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block px-4 py-4 overflow-y-auto">
            <h2 className="text-sm font-medium text-gray-900 mb-3">
              Categories
            </h2>
            <div className="flex flex-col gap-1">
              {STATIC_CATEGORIES.map((meta) => (
                <Button
                  key={meta.key}
                  variant={activeCategory === meta.label ? 'default' : 'ghost'}
                  size="sm"
                  className={`justify-between px-4 py-3 rounded-lg text-left font-medium gap-2 ${
                    activeCategory === meta.label
                      ? 'bg-primary-50 text-primary-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setActiveCategory(meta.label);
                    navigate(`/libraries/${meta.key}`);
                  }}
                >
                  <span>{meta.label}</span>
                  {['All Reports', 'All Workflows', 'All Packages'].includes(
                    meta.label
                  ) && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {getStaticCategoryCount(meta.label)}
                    </span>
                  )}
                </Button>
              ))}

              <Button
                key={MY_BLUEPRINTS_CATEGORY.key}
                variant={
                  activeCategory === MY_BLUEPRINTS_CATEGORY.label
                    ? 'default'
                    : 'ghost'
                }
                size="sm"
                className={`justify-between px-4 py-3 rounded-lg text-left font-medium gap-2 ${
                  activeCategory === MY_BLUEPRINTS_CATEGORY.label
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => {
                  setActiveCategory(MY_BLUEPRINTS_CATEGORY.label);
                  navigate(`/libraries/${MY_BLUEPRINTS_CATEGORY.key}`);
                }}
              >
                <span>{MY_BLUEPRINTS_CATEGORY.label}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {getStaticCategoryCount(MY_BLUEPRINTS_CATEGORY.label)}
                </span>
              </Button>

              <div className="border-t border-gray-200 my-2" />

              {categories.map((category) => (
                <Button
                  key={category}
                  variant={activeCategory === category ? 'default' : 'ghost'}
                  size="sm"
                  className={`justify-between px-4 py-3 rounded-lg text-left font-medium gap-2 ${
                    activeCategory === category
                      ? 'bg-primary-50 text-primary-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => handleCategoryClick(category)}
                >
                  <span>{category}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {getCategoryCount(category)}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white px-4 sm:px-6 py-4 min-w-0 flex flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-white pb-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal text-primary-800 mb-2">
              {activeCategory}
            </h2>

            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search..."
                leftIcon={<Search className="h-4 w-4" />}
                className="h-[40px] sm:h-[48px]"
                onChange={(e) => setSearchBarValue(e.target.value)}
                value={searchBarValue}
              />
            </div>

            <div
              className={
                showSecurityCategoryCallouts ? 'mb-2' : 'mb-4 sm:mb-6'
              }
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm text-gray-600 font-medium">
                  Filters
                </span>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 sm:pb-0 sm:flex-wrap sm:overflow-visible">
                  {/* All button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTypeFilters({
                        workflow: true,
                        package: true,
                        report: true,
                      });
                      const resetClassFilters = availableClasses.reduce(
                        (acc, classType) => {
                          acc[classType] = true;
                          return acc;
                        },
                        {}
                      );
                      setClassFilters(resetClassFilters);
                      setCloudProviderFilters({
                        aws: true,
                        gcp: true,
                        azure: true,
                        google_workspace: true,
                      });
                    }}
                    className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-full text-sm ${
                      Object.values(typeFilters).every(Boolean) &&
                      Object.values(classFilters).every(Boolean) &&
                      Object.values(cloudProviderFilters).every(Boolean)
                        ? 'bg-primary-100 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    All
                  </Button>

                  {/* Divider */}
                  <div className="hidden sm:block w-px bg-gray-200 mx-1" />

                  {/* Cloud Provider Filters */}
                  {availableFiltersInCategory.cloudProviders.includes('aws') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCloudProviderFilters((prev) => ({
                          ...prev,
                          aws: !prev.aws,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        cloudProviderFilters.aws
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icons.aws className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">AWS</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.cloudProviders.includes('gcp') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCloudProviderFilters((prev) => ({
                          ...prev,
                          gcp: !prev.gcp,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        cloudProviderFilters.gcp
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icons.gcp className="w-4 h-4 sm:w-5 sm:h-5" style={{ objectFit: 'contain' }} />
                      <span className="hidden sm:inline">GCP</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.cloudProviders.includes('azure') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCloudProviderFilters((prev) => ({
                          ...prev,
                          azure: !prev.azure,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        cloudProviderFilters.azure
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icons.azure className="w-4 h-4 sm:w-5 sm:h-5" style={{ objectFit: 'contain' }} />
                      <span className="hidden sm:inline">Azure</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.cloudProviders.includes('google_workspace') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCloudProviderFilters((prev) => ({
                          ...prev,
                          google_workspace: !prev.google_workspace,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        cloudProviderFilters.google_workspace
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icons.googleWorkspace className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Google Workspace</span>
                    </Button>
                  )}

                  {/* Divider if there are type/class filters */}
                  {(availableFiltersInCategory.types.length > 0 || availableFiltersInCategory.classes.length > 0) && 
                   availableFiltersInCategory.cloudProviders.length > 0 && (
                    <div className="hidden sm:block w-px bg-gray-200 mx-1" />
                  )}

                  {/* Type and Class Filters - only show if available in category */}
                  {availableFiltersInCategory.classes.includes('build') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setClassFilters((prev) => ({
                          ...prev,
                          build: !prev.build,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        classFilters.build
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Blocks className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Build</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.types.includes('report') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilters((prev) => ({
                          ...prev,
                          report: !prev.report,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        typeFilters.report
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <BookCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Reports</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.classes.includes('operations') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setClassFilters((prev) => ({
                          ...prev,
                          operations: !prev.operations,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        classFilters.operations
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Bolt className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Operations</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.types.includes('workflow') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilters((prev) => ({
                          ...prev,
                          workflow: !prev.workflow,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        typeFilters.workflow
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Workflows</span>
                    </Button>
                  )}

                  {availableFiltersInCategory.types.includes('package') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilters((prev) => ({
                          ...prev,
                          package: !prev.package,
                        }));
                      }}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-sm ${
                        typeFilters.package
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Packages</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {showSecurityCategoryCallouts && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchBarValue('');
                    setTypeFilters({
                      workflow: false,
                      package: false,
                      report: true,
                    });
                  }}
                  className="group flex items-center justify-between rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                      <BookCheck className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-primary-900">
                        Explore Cloud Reports
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-600">
                        {securityReportCount} security reports available
                      </span>
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary-500 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchBarValue('compliance');
                    setTypeFilters({
                      workflow: false,
                      package: false,
                      report: true,
                    });
                  }}
                  className="group flex items-center justify-between rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-emerald-950">
                        Browse Compliance Frameworks
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-600">
                        {securityFrameworkCount} frameworks and benchmarks
                      </span>
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-emerald-500 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeCategory && (
              <div className="mb-6">
                {getFeaturedItems(activeCategory).length > 0 && (
                  <>
                    <h3 className="text-xl sm:text-2xl font-bold text-primary-700 mb-3">
                      Featured
                    </h3>
                    <div className="bg-white rounded-lg border border-primary-200 overflow-hidden mb-6 sm:mb-8">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-primary-50 hover:bg-primary-50">
                            <TableHead className="w-[50px]">Provider</TableHead>
                            <TableHead className="min-w-[200px]">Title</TableHead>
                            <TableHead className="w-[140px]">Type</TableHead>
                            <TableHead className="hidden md:table-cell max-w-[400px]">Description</TableHead>
                            <TableHead className="w-[100px] text-right">Credits</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFeaturedItems(activeCategory).map((item, index) => (
                            <LibraryItemRow
                              key={item.id || index}
                              item={item}
                              onClick={() => handleItemClick(item)}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 text-lg mb-2">
                      No items found
                    </div>
                    <div className="text-gray-400 text-sm">
                      Try adjusting your search or filters
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6 sm:mb-8">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="w-[50px]">Provider</TableHead>
                          <TableHead className="min-w-[200px]">Title</TableHead>
                          <TableHead className="w-[140px]">Type</TableHead>
                          <TableHead className="hidden md:table-cell max-w-[400px]">Description</TableHead>
                          <TableHead className="w-[100px] text-right">Credits</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <LibraryItemRow
                            key={item.uniqueId}
                            item={item}
                            onClick={() => handleItemClick(item)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {isHelpChatOpen && (
        <HelpChatModal onClose={() => setIsHelpChatOpen(false)} />
      )}
    </div>
  );
};

const WorkflowCard = ({
  title,
  description,
  credits,
  onRun,
  onEdit,
  disabled,
}) => {
  return (
    <Card
      className={`w-full h-full transition-colors cursor-pointer group relative ${
        disabled
          ? 'opacity-50 pointer-events-none bg-gray-50'
          : 'hover:bg-primary-50 hover:border-primary-200'
      }`}
      onClick={onEdit}
    >
      {' '}
      <div className="flex flex-col justify-between h-[100%]">
        <div>
          <CardHeader className="p-4">
            <div className="bg-primary-50 flex border border-primary-50 rounded-[8px] p-[8px] group-hover:border-primary-200 mb-2 w-fit mt-2">
              <PlayCircle className="w-6 h-6 mr-2 text-primary-500" /> Workflow
            </div>
            <CardTitle className="text-xl text-primary-800 group-hover:text-primary-700 font-normal line-clamp-2">
              {title}
            </CardTitle>
          </CardHeader>

          <CardContent className="px-4 py-0 flex-grow">
            <p className="text-gray-600 mb-4 line-clamp-3">{description}</p>
          </CardContent>
        </div>
        <div className="flex items-center p-4">
          <div className="flex items-center justify-between bg-primary-50 text-primary-600 px-[12px] py-[8px] rounded-[25px] group-hover:rounded-full border border-primary-50 group-hover:border-primary-200 w-full group-hover:w-full transition-all duration-300 ease-in-out">
            <div className="flex items-center gap-2">
              <Icons.toll className="w-6 h-6" />
              <span className="font-medium">{credits} Credits</span>
            </div>
            <ArrowRight className="w-4 h-4 transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100 invisible group-hover:visible" />
          </div>
        </div>
      </div>
    </Card>
  );
};

// Helper function to get cloud provider icon
const getCloudProviderIcon = (cloudProvider) => {
  switch (cloudProvider?.toLowerCase()) {
    case 'aws':
      return <Icons.aws className="h-5 w-5" />;
    case 'gcp':
    case 'google':
      return <Icons.gcp className="h-5 w-5" style={{ objectFit: 'contain' }} />;
    case 'azure':
      return <Icons.azure className="h-5 w-5" style={{ objectFit: 'contain' }} />;
    case 'google_workspace':
      return <Icons.googleWorkspace className="h-5 w-5" />;
    default:
      return <Icons.aws className="h-5 w-5" />; // Default to AWS
  }
};

// Helper function to get type badge styling
const getTypeBadge = (type, itemClass) => {
  switch (type) {
    case 'workflow':
      return {
        icon: <PlayCircle className="w-3.5 h-3.5 mr-1" />,
        label: 'Workflow',
        className: 'bg-purple-100 text-purple-700',
      };
    case 'package':
      return {
        icon: <Package className="w-3.5 h-3.5 mr-1" />,
        label: 'Package',
        className: 'bg-blue-100 text-blue-700',
      };
    case 'report':
      return {
        icon: <BookCheck className="w-3.5 h-3.5 mr-1" />,
        label: 'Report',
        className: 'bg-green-100 text-green-700',
      };
    case 'agent':
      if (itemClass === 'build') {
        return {
          icon: <Blocks className="w-3.5 h-3.5 mr-1" />,
          label: 'Build',
          className: 'bg-orange-100 text-orange-700',
        };
      } else if (itemClass === 'operations') {
        return {
          icon: <Bolt className="w-3.5 h-3.5 mr-1" />,
          label: 'Operations',
          className: 'bg-amber-100 text-amber-700',
        };
      }
      return {
        icon: <Blocks className="w-3.5 h-3.5 mr-1" />,
        label: 'Agent',
        className: 'bg-cyan-100 text-cyan-700',
      };
    default:
      return {
        icon: null,
        label: type || 'Item',
        className: 'bg-gray-100 text-gray-700',
      };
  }
};

const LibraryItemRow = ({ item, onClick }) => {
  const typeBadge = getTypeBadge(item.type, item.class);
  const isDisabled = !item.active;

  return (
    <TableRow
      className={`cursor-pointer transition-colors ${
        isDisabled
          ? 'opacity-50 pointer-events-none bg-gray-50'
          : 'hover:bg-primary-50'
      }`}
      onClick={isDisabled ? undefined : onClick}
    >
      <TableCell className="w-[50px]">
        <div className="flex items-center justify-center">
          {getCloudProviderIcon(item.cloudProvider)}
        </div>
      </TableCell>
      <TableCell className="min-w-[200px]">
        <div className="flex flex-col">
          <span className="font-medium text-primary-800 group-hover:text-primary-700">
            {item.title}
          </span>
          {item.type === 'package' && (
            <span className="text-xs text-gray-500 mt-0.5">
              Includes {item.includedAgents || 10} Agents
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[140px]">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeBadge.className}`}
        >
          {typeBadge.icon}
          {typeBadge.label}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell max-w-[400px]">
        <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
      </TableCell>
      <TableCell className="w-[100px] text-right">
        <div className="inline-flex items-center gap-1 text-primary-600 font-medium">
          <Icons.toll className="w-4 h-4" />
          <span className="text-sm">{item.credits}</span>
        </div>
      </TableCell>
      <TableCell className="w-[50px]">
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </TableCell>
    </TableRow>
  );
};

export default AllLibraries;
